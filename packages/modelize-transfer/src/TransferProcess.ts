import {
    Transfer,
    TransferBeforeFn, TransferFilterFn,
    TransferLoadFn, TransferWriteFn,
    TransferOpts, TransferProgressLogger,
} from '@modelize/transfer/Transfer.js'
import { TransferStats } from '@modelize/transfer/TransferStats'

export class TransferProcess<R, LD, WD, L, W, O extends TransferOpts = TransferOpts> {

    protected filterFn: undefined | TransferFilterFn<LD> = undefined
    protected beforeFn: undefined | TransferBeforeFn<L, W, R> = undefined

    protected loadFn: TransferLoadFn<LD, L, R> | undefined = undefined
    protected writeFn: TransferWriteFn<WD, W> | undefined = undefined

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

    onLoad(loadFn: TransferLoadFn<LD, L, R>): TransferProcess<R, LD, WD, L, W, O> {
        this.loadFn = loadFn
        return this
    }

    onWrite(writeFn: TransferWriteFn<WD, W>): TransferProcess<R, LD, WD, L, W, O> {
        this.writeFn = writeFn
        return this
    }

    protected async process(resumeInfo?: R): Promise<R> {
        if(!this.loadFn) {
            throw new Error('before run, define a `loadFn`')
        }
        const writeFn = this.writeFn
        if(!writeFn) {
            throw new Error('before run, define a `writeFn`')
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
        const {rows, resumeInfo: nextResumeInfo} = await this.loadFn(this.transfer.loader, resumeInfo)
        this.stats.hasLoaded(rows.length, startLoad)

        await this.progressLogger?.(
            `     ` +
            `loaded rows: ` + rows.length,
            {
                trace: this.opts?.trace,
                severity: 'info',
                progress: 'load-end',
                stats: this.stats,
                resumeInfo: resumeInfo,
            },
        )

        const transformedData: WD[] = []
        for(const loadedRow of rows) {
            const startTransform = this.stats.timeTag()
            // todo: add invalid items log
            if(this.filterFn && !this.filterFn(loadedRow)) {
                this.stats.hasFiltered()
                this.stats.hasTransformed(startTransform)
                continue
            }
            const maybeTransformedRow = this.transfer.transformFn(loadedRow)
            transformedData.push(await Promise.resolve(maybeTransformedRow).then(res => res))
            this.stats.hasTransformed(startTransform)
        }

        const {batchWrite} = this.opts || {}
        const batchWriter = async(parsedData2: WD[], batchSize = 1) => {
            const writeBatch = parsedData2.splice(0, batchSize)
            if(writeBatch.length > 0) {
                const startWrite = this.stats.timeTag()
                // todo: add item-write-failed log
                await writeFn(this.transfer.writer, writeBatch[0], ...writeBatch.slice(1))
                this.stats.hasWritten(writeBatch.length, startWrite)
            }
            // todo: add on-progress "after" log here
            if(parsedData2.length > 0) {
                await batchWriter(parsedData2, batchSize)
            }
        }

        const fullLength = transformedData.length
        await this.progressLogger?.(
            `     ` +
            `writing (${fullLength}) ...`,
            {
                trace: this.opts?.trace,
                severity: 'info',
                progress: 'write-end',
                stats: this.stats,
                resumeInfo: resumeInfo,
            },
        )

        await batchWriter(transformedData, batchWrite)

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

        return nextResumeInfo as R
    }

    protected async run(resumeInfo?: R): Promise<void> {
        const nextResumeInfo = await this.process(resumeInfo)
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
        if(nextResumeInfo) {
            await this.run(nextResumeInfo)
        }
    }

    async start(): Promise<TransferStats> {
        this.stats.markStarted()
        await this.progressLogger?.(` > model transfer starting...`, {
            trace: this.opts?.trace,
            severity: 'info',
            progress: 'start',
        })
        let resumeInfo: R | undefined = undefined
        if(this.beforeFn) {
            resumeInfo = await this.beforeFn(this.transfer.loader, this.transfer.writer) as Awaited<R>
        }

        await this.run(resumeInfo)

        await this.progressLogger?.(`   ✓ model transfer ended.`, {
            trace: this.opts?.trace,
            severity: 'info',
            progress: 'end',
        })
        this.stats.markCompleted()

        return this.stats
    }
}
