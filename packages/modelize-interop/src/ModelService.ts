import { ErrorModelNotFound } from '@modelize/interop/ErrorModelNotFound'

export interface ModelInteropDescription {
    // the ID of the model, should identify the model,
    // but it shouldn't be assumed that it is unique
    id: string
    // to which provider the description belongs
    provider: string
    // to which software/business domain the model belongs
    domain: 'system' | string
    // indicate that the model data can not be altered at runtime
    readOnly?: boolean
    // indicate that the model does not need to be created before usage
    autoCreate?: boolean
}

export type ModelOperationResult = [boolean, string[]]

export interface ModelInteropDefinition<D extends ModelInteropDescription = ModelInteropDescription> {
    desc: D
    onInstall?: () => Promise<ModelOperationResult>
    onUpdate?: () => Promise<ModelOperationResult>
    onUninstall?: () => Promise<ModelOperationResult>
}

export interface ModelInteropRepo<D extends ModelInteropDescription = ModelInteropDescription> {
    getModel(): ModelInteropDefinition<D>
}

export type ModelInteropRuntimeSpecDef<D extends ModelInteropDescription = ModelInteropDescription> = {
    def: (ModelInteropDefinition<D> | (() => ModelInteropDefinition<D>))
}

export type ModelInteropRuntimeSpecRepo<D extends ModelInteropDescription = ModelInteropDescription, R extends ModelInteropRepo<D> = ModelInteropRepo<D>> = {
    repo: R | (() => R)
}

export type ModelInteropRuntimeSpec<D extends ModelInteropDescription = ModelInteropDescription> = (ModelInteropRuntimeSpecDef<D> | ModelInteropRuntimeSpecRepo<D>) & {
    tags: string[]
}

export class ModelService {
    protected readonly modelSpecs: {
        [id: string]: ModelInteropRuntimeSpec
    }
    protected repoInstances: { [id: string]: ModelInteropRepo } = {}

    public constructor(modelSpecs: {
        [id: string]: ModelInteropRuntimeSpec
    }) {
        this.modelSpecs = modelSpecs
    }

    getModel(id: string): ModelInteropDefinition {
        if(!this.modelSpecs[id]) {
            throw new ErrorModelNotFound()
        }
        let modelDef
        const modelSpec = this.modelSpecs[id]
        if('def' in modelSpec) {
            modelDef = modelSpec.def
        } else {
            modelDef = this.getRepo(id).getModel()
        }
        return typeof modelDef === 'function' ? modelDef() : modelDef
    }

    getRepo<R extends ModelInteropRepo = ModelInteropRepo>(id: string): R {
        const modelSpec = this.modelSpecs[id]
        if('repo' in modelSpec) {
            const r = modelSpec.repo
            if(!this.repoInstances[id]) {
                this.repoInstances[id] = typeof r === 'function' ? r() : r
            }
            return this.repoInstances[id] as R
        }
        throw new Error('can not get repo, repo-less model: ' + id)
    }

    defineModel(
        id: string,
        modelSpec: ModelInteropRuntimeSpec,
    ) {
        if(this.modelSpecs[id]) {
            throw new Error('can not define model, already exists: ' + id)
        }
        this.modelSpecs[id] = modelSpec
    }

    getModelsByTag(tag: string): string[] {
        return Object.keys(this.modelSpecs).filter(k => this.modelSpecs[k].tags.includes(tag))
    }
}
