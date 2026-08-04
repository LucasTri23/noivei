// Conversão do controle de zoom da foto de capa (0-100, coluna cover_photo_zoom em
// site_config — ver migration 20260804000001) para o fator de `transform: scale(...)`
// aplicado por cima do `background-size: cover` já calculado automaticamente pelo
// navegador a partir do aspect ratio real da imagem. Mesma fórmula documentada no
// comentário da migration: 1.0x (sem zoom extra, valor 0) até 1.6x (zoom máximo, valor
// 100) — teto escolhido para não pixelizar/distorcer a foto visivelmente.
export function coverPhotoZoomScale(zoom: number): number {
  return 1 + (zoom / 100) * 0.6
}
