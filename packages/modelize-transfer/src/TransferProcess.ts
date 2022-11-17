import {
    Transfer,
    TransferBeforeFn, TransferFilterFn,
    TransferLoadFn, TransferWriteFn,
    TransferOpts, TransferProgressLogger, TransferBeforeWriteFn,
} from '@modelize/transfer/Transfer.js'
import { TransferStats } from '@modelize/transfer/TransferStats'

export class TransferProcess<R, LD, WD, L, W, O extends TransferOpts = TransferOpts> {

    protected filterFn: undefined | TransferFilterFn<LD> = undefined
    protected beforeFn: undefined | TransferBeforeFn<L, W, R> = undefined

    protected loadFn: TransferLoadFn<LD, L, O, R> | undefined = undefined
    protected beforeWriteFn: undefined | TransferBeforeWriteFn<O, WD, R> = undefined
    protected writeFn: TransferWriteFn<WD, W, O> | undefined = undefined

    protected transfer: Transfer<LD, WD, L, W>
    protected readonly stats: TransferStats
    protected readonly opts?: O
    protected readonly progressLogger?: TransferProgressLogger<R>

    constructor(
        transfer: Transfer<LD, WD, L, W>,
        opts?: O,
        onBefore?: TransferBeforeFn<L, W, R>,
        progressLogger?: TransferProgressLogger<R>,
        stats: TransferStats = new TransferStats(),
    ) {
        this.transfer = transfer
        this.opts = opts
        this.beforeFn = onBefore
        this.stats = stats
        this.progressLogger = progressLogger
    }

    filter(onRow: TransferFilterFn<LD>): TransferProcess<R, LD, WD, L, W, O> {
        this.filterFn = onRow
        return this
    }

    onLoad(loadFn: TransferLoadFn<LD, L, O, R>): TransferProcess<R, LD, WD, L, W, O> {
        this.loadFn = loadFn
        return this
    }

    beforeWrite(beforeWriteFn: TransferBeforeWriteFn<O, WD, R>): TransferProcess<R, LD, WD, L, W, O> {
        this.beforeWriteFn = beforeWriteFn
        return this
    }

    onWrite(writeFn: TransferWriteFn<WD, W, O>): TransferProcess<R, LD, WD, L, W, O> {
        this.writeFn = writeFn
        return this
    }

    protected async processLoadTransform(resumeInfo?: R): Promise<{ resumeInfo: R | undefined, transformedData: WD[] }> {
        if(!this.loadFn) {
            throw new Error('before run, define a `loadFn`')
        }

        await this.progressLogger?.(
            `     ` +
            `loading ...`,
            {
                trace: this.opts?.trace,
                severity: 'info',
                progress: 'load-start',
                stats: this.stats,
                resumeInfo: resumeInfo,
            },
        )

        const startLoad = this.stats.timeTag()
        const {rows, resumeInfo: nextResumeInfo} = await this.loadFn(this.transfer.loader, resumeInfo, this.opts)
        const fullLengthLoaded = rows.length
        this.stats.hasLoaded(fullLengthLoaded, startLoad)

        await this.progressLogger?.(
            `     ` +
            `loaded rows: ` + fullLengthLoaded,
            {
                trace: this.opts?.trace,
                severity: 'info',
                progress: 'load-end',
                stats: this.stats,
                resumeInfo: resumeInfo,
            },
        )

        const transformedData: WD[] = []
        let loadedRow = rows.shift()
        do {
            if(!loadedRow) continue
            const startTransform = this.stats.timeTag()
            // todo: add invalid items log
            if(this.filterFn && !this.filterFn(loadedRow)) {
                this.stats.hasFiltered()
                this.stats.hasTransformed(startTransform)
            } else {
                const maybeTransformedRow = this.transfer.transformFn(loadedRow)
                transformedData.push(await Promise.resolve(maybeTransformedRow).then(res => res))
                this.stats.hasTransformed(startTransform)
            }
            loadedRow = rows.shift()
        } while(loadedRow)

        const fullLength = transformedData.length
        await this.progressLogger?.(
            `     ` +
            `filtered out: ${fullLengthLoaded - fullLength}${fullLength ? ', writing: ' + fullLength + '...' : ''}`,
            {
                trace: this.opts?.trace,
                severity: 'info',
                progress: 'write-end',
                stats: this.stats,
                resumeInfo: resumeInfo,
            },
        )

        return {
            resumeInfo: nextResumeInfo as R,
            transformedData: transformedData,
        }
    }

    protected async processWrite(resumeInfo: R | undefined, transformedData: WD[]): Promise<R | undefined> {
        const writeFn = this.writeFn
        if(!writeFn) {
            throw new Error('before run, define a `writeFn`')
        }
        const {batchWrite} = this.opts || {}

        const nextResumeInfo = this.beforeWriteFn?.(this.opts, resumeInfo, transformedData) || resumeInfo
        const fullLength = transformedData.length

        do {
            const writeBatch = transformedData.splice(0, batchWrite)
            if(writeBatch.length > 0) {
                const startWrite = this.stats.timeTag()
                // todo: add item-write-failed log
                // todo: add fail strategies: retry-x, ignore, fail-fast
                await writeFn(this.transfer.writer, writeBatch, this.opts)
                this.stats.hasWritten(writeBatch.length, startWrite)
            }
            // todo: add on-progress "after" log here
        } while(transformedData.length > 0)

        if(fullLength > 0) {
            await this.progressLogger?.(
                `     ` +
                `written: ` + fullLength,
                {
                    trace: this.opts?.trace,
                    severity: 'info',
                    progress: 'write-end',
                    stats: this.stats,
                    resumeInfo: resumeInfo,
                },
            )
        }

        return nextResumeInfo as R
    }

    protected async run(resumeInfo: R | undefined): Promise<R | undefined> {
        const {
            resumeInfo: nextResumeInfo1,
            transformedData,
        } = await this.processLoadTransform(resumeInfo)

        const nextResumeInfo2 = await this.processWrite(nextResumeInfo1, transformedData.splice(0))

        await this.progressLogger?.(
            `     ` +
            `batch: ${this.stats.batches.toFixed(0).padStart(2, ' ')} .. ` +
            `loaded: ${this.stats.rows_loaded.toFixed(0).padStart(3, ' ')} .. ` +
            `written: ${this.stats.rows_written.toFixed(0).padStart(3, ' ')}`,
            {
                trace: this.opts?.trace,
                severity: 'info',
                progress: 'batch-end',
                stats: this.stats,
            },
        )
        this.stats.batchEnded()

        return nextResumeInfo2
    }

    async start(): Promise<TransferStats> {
        this.stats.markStarted()
        await this.progressLogger?.(` > transfer starting...`, {
            trace: this.opts?.trace,
            severity: 'info',
            progress: 'start',
        })
        let resumeInfo: R | undefined = undefined
        if(this.beforeFn) {
            resumeInfo = await this.beforeFn(this.transfer.loader, this.transfer.writer) as Awaited<R>
        }

        do {
            resumeInfo = await this.run(resumeInfo)
        } while(resumeInfo)

        await this.progressLogger?.(`   ✓ transfer ended.`, {
            trace: this.opts?.trace,
            severity: 'info',
            progress: 'end',
        })
        this.stats.markCompleted()

        return this.stats
    }
}
