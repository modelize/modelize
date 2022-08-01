import { ModelInteropDescription, ModelService } from '@modelize/interop/ModelService'

export interface ModelSetupInfo extends ModelInteropDescription {
    exists?: boolean
}

export interface ModelSetupChanges {
    id: string
    success: boolean
    skipped?: boolean
}

export const ModelSetup = {
    async install(modelService: ModelService, tag: string): Promise<{
        models: ModelSetupInfo[]
        log: string[]
        changes: ModelSetupChanges[]
    }> {
        const models = modelService.getModelsByTag(tag) || {}
        const installed: ModelSetupChanges[] = []
        const fullLog: string[] = []
        const modelsInfo: ModelSetupInfo[] = []
        for(const modelId of models) {
            const model = modelService.getModel(modelId)
            let created: boolean = false
            if(model.onInstall) {
                const [success, log] = await model.onInstall()
                fullLog.push(...log)
                installed.push({
                    id: model.desc.id,
                    success: success,
                })
                created = success
            } else {
                fullLog.push(' > db skipped `' + model.desc.id + '`, no `onInstall`')
                installed.push({
                    id: model.desc.id,
                    success: Boolean(model.desc.autoCreate),
                    skipped: true,
                })
                created = Boolean(model.desc.autoCreate)
            }
            modelsInfo.push({
                ...model.desc,
                exists: created,
            })
        }

        return {
            models: modelsInfo,
            log: fullLog,
            changes: installed,
        }
    },
    async uninstall(modelService: ModelService, tag: string): Promise<{
        models: ModelSetupInfo[]
        log: string[]
        changes: ModelSetupChanges[]
    }> {
        const models = modelService.getModelsByTag(tag) || {}
        const uninstalled: any[] = []
        const fullLog: string[] = []
        const modelsInfo: any[] = []
        for(const modelId of models) {
            const model = modelService.getModel(modelId)
            let deleted: boolean = false
            if(model.onUninstall) {
                const [success, log] = await model.onUninstall()
                fullLog.push(...log)
                uninstalled.push({
                    id: model.desc.id,
                    success: success,
                })
                deleted = success
            } else {
                fullLog.push(' > db skipped `' + model.desc.id + '`, no `onUninstall`')
                uninstalled.push({
                    id: model.desc.id,
                    success: false,
                    skipped: true,
                })
            }
            modelsInfo.push({
                ...model.desc,
                // todo: add something like db-check in the model abstraction
                exists: !deleted,
                // exists: !deleted && dbs.includes(modelId),
            })
        }

        return {
            models: modelsInfo,
            log: fullLog,
            changes: uninstalled,
        }
    },
}
