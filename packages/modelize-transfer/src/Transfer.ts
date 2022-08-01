import { TransferProcess } from '@modelize/transfer/TransferProcess'
import { TransferStats } from '@modelize/transfer/TransferStats'

export type TransferLoadFn<LD, L, R> = (loader: L, resumeInfo?: R) => Promise<{
    rows: LD[]
    resumeInfo?: R
}>

export type TransferWriteFn<WD, W> = (writer: W, row: WD, ...rows: WD[]) => Promise<void>

export type TransferBeforeFn<L, W, R> = (loader: L, writer: W) => Promise<R | undefined | void>

export type TransferFilterFn<LD> = (row: LD) => boolean

export type TransferTransformFn<LD, WD> = (loadingData: LD) => WD | Promise<WD>

export type TransferProgressLogger<R> = (
    message: string,
    params?: {
        trace?: string
        severity?: 'debug' | 'default' | 'info' | 'warn' | 'error' | 'critical'
        progress?: 'start' | 'end' | 'batch-start' | 'batch-end' | 'load-start' | 'load-end' | 'write-start' | 'write-end'
        stats?: TransferStats
        resumeInfo?: R
    },
) => void | Promise<void>

export interface TransferOpts {
    // a in-process write batch, splits the loaded elements for writing, defaults to `1`
    batchWrite?: number
    // optional error tracing
    trace?: string
}

export class Transfer<LD, WD, L, W> {
    transformFn: TransferTransformFn<LD, WD>

    loader: L
    writer: W

    constructor(
        loader: L,
        writer: W,
        transform: TransferTransformFn<LD, WD>,
    ) {
        this.loader = loader
        this.writer = writer
        this.transformFn = transform
    }

    nextProcess<R, O extends TransferOpts = TransferOpts>(
        opts?: O,
        onBefore?: TransferBeforeFn<L, W, R>,
        progressLogger?: TransferProgressLogger<R>,
    ): TransferProcess<R, LD, WD, L, W, O> {
        return new TransferProcess(this, opts, onBefore, progressLogger)
    }
}
