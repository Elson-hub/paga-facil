/**
 * Versão do Paga Fácil.
 * - VERSAO: número que a gente muda à mão quando quiser (1.0, 1.1, 2.0…).
 * - PUBLICACAO: carimbo automático DDHHmm da publicação (ex.: 151713 =
 *   dia 15, 17:13), gerado pelo GitHub na hora de montar o app.
 */
export const VERSAO = '1.0'
export const PUBLICACAO = __PUBLICACAO_CODIGO__
export const PUBLICACAO_DATA = __PUBLICACAO_DATA__

/** Ex.: "1.0 151713" */
export const VERSAO_COMPLETA = `${VERSAO} ${PUBLICACAO}`
