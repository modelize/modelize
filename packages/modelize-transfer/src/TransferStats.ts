import process from 'process'

export class TransferStats {
    public status: string = 'setup'
    public started_at?: Date
    public completed_at?: Date
    private started_at_exact?: [number, number]
    /**
     * duration as: [seconds, nanoseconds]
     */
    public elapsed: [number, number] = [0, 0]
    /**
     * duration as `microseconds`
     */
    public dur_load: number = 0
    /**
     * duration as `microseconds`
     */
    public dur_transform: number = 0
    /**
     * duration as `microseconds`
     */
    public dur_write: number = 0
    /**
     * number of runs in this process, zero-index
     * a new batch is each new `load`, after the previous "load - transform - write", when the `load` returned an `resumeInfo`
     */
    public batches: number = 0
    public rows_filtered: number = 0
    public rows_transformed: number = 0
    public rows_loaded: number = 0
    public rows_written: number = 0

    markStarted() {
        this.started_at_exact = process.hrtime()
        this.started_at = new Date()
    }

    markCompleted() {
        this.completed_at = new Date()
        this.status = 'completed'
        this.elapsed = process.hrtime(this.started_at_exact)
    }

    batchEnded() {
        this.batches += 1
    }

    hasFiltered() {
        this.rows_filtered += 1
    }

    hasTransformed(
        start: [number, number],
    ) {
        this.rows_transformed += 1
        const elapsed = process.hrtime(start)
        this.dur_transform += parseInt(((elapsed[0] * 1e9 + elapsed[1]) / 1e3).toFixed(0))
    }

    hasLoaded(
        batch: number = 1,
        start: [number, number],
    ) {
        this.rows_loaded += batch
        const elapsed = process.hrtime(start)
        this.dur_load += parseInt(((elapsed[0] * 1e9 + elapsed[1]) / 1e3).toFixed(0))
    }

    hasWritten(
        batch: number = 1,
        start: [number, number],
    ) {
        this.rows_written += batch
        const elapsed = process.hrtime(start)
        this.dur_write += parseInt(((elapsed[0] * 1e9 + elapsed[1]) / 1e3).toFixed(0))
    }

    timeTag(): [number, number] {
        return process.hrtime()
    }

    printPretty(): void {
        process.stdout.write(`
status:         ${this.status}
rows loaded:    ${this.rows_loaded}
rows filtered:  ${this.rows_filtered}
rows written:   ${this.rows_written}
dur. load:      ${(this.dur_load / 1000).toFixed(0)}ms
dur. transform: ${(this.dur_transform / 1000).toFixed(0)}ms
dur. write:     ${(this.dur_write / 1000).toFixed(0)}ms
elapsed:        ${TransferStats.elapsedToMillis(this.elapsed)}ms
`)
    }

    static elapsedToMillis(elapsed: [number, number]): number {
        return parseInt((((elapsed[0] * 1e9) + elapsed[1]) / 1e6).toFixed(0))
    }

    static elapsedToMicro(elapsed: [number, number]) {
        return parseInt((((elapsed[0] * 1e9) + elapsed[1]) / 1e3).toFixed(0))
    }
}
