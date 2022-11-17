# Modelize Transfer

```shell
npm i --save @modelize/transfer
```

## Execution Flow

Start a new transfer with basic options: `new Transfer().start()`

1. `onBefore()`: returns `resumeInfo`
2. *do process:*
    1. `onLoad()`: consumes `resumeInfo` and reduces raw-rows
    2. for each loaded `raw-row`:
        1. `onFilter()`: consumes `raw-row`, return `false` to exclude row
        2. `transform()`: consumes `raw-row` must produce `write-row`
            - filtered/transformed `raw-row` is cleaned directly from internal memory
    3. `beforeWrite()`: consumes `write-rows`, may change the `resumeInfo`
        - must be run before `writing`, as the already written rows are cleaned directly from internal memory
    4. for each `batch-to-write`
        1. `onWrite()`: consumes batch of `write-row`
3. repeat process if `resumeInfo` not `undefined` now
