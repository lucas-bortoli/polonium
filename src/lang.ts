const pt_BR = {
    cmdStartNeedVoiceChannel            : "Você deve estar em um canal de voz para iniciar a gravação.",
    cmdStartAlreadyRecordingAskOverride : "Só é possível gravar um canal de voz ao mesmo tempo, e já há uma gravação acontecendo nesse servidor. Deseja pará-la? Digite `%{PREFIX}yes` para confirmar.",
    cmdStartAlreadyRecording            : "Já há uma gravação acontecendo nesse servidor.",
    cmdStartEnteringChannel             : "Entrando no canal...",

    cmdStopNotRecording                 : "Não há nenhuma gravação ocorrendo nesse servidor.",
    cmdStopInsufficientPermissions      : "Você não tem permissão para parar a gravação atual.",
    
    recordingProcessingStart            : "Aguarde! Processando a gravação - pode demorar um pouco...",
    recordingProcessingError            : "Ocorreu um erro ao processar a gravação.",
    recordingUploading                  : "Fazendo upload... Enviarei também o link no seu DM quando terminar. (são %{SIZE})",
    recordingProcessingDone             : "✅ Processamento concluído",
}

type LanguageFields = keyof typeof pt_BR

const l = (field: LanguageFields, vars: { [key: string]: string } = {}): string => {
    let rawString = pt_BR[field]

    // Replace $vars in string with the supplied parameters
    for (const [ variable, value ] of Object.entries(vars)) {
        rawString = rawString.replaceAll(`%{${variable}}`, value)
    }

    return rawString
}

export { l, LanguageFields }