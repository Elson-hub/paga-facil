/**
 * Bloqueio do app com Face ID / Touch ID / Windows Hello (WebAuthn).
 * Funciona como trava do aparelho: a chave fica guardada no próprio
 * aparelho, e o app só abre depois que o sistema confirma a biometria.
 * A configuração vale só para este aparelho.
 */

const chave = (usuarioId: string) => `pagafacil.bloqueio.${usuarioId}`

const paraB64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deB64 = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, c => c.charCodeAt(0))
}
/** Copia para um ArrayBuffer simples (evita diferenças de tipo entre versões do TypeScript). */
const buf = (u: Uint8Array): ArrayBuffer => {
  const b = new ArrayBuffer(u.byteLength)
  new Uint8Array(b).set(u)
  return b
}
const aleatorio = () => buf(crypto.getRandomValues(new Uint8Array(32)))

/** "Face ID" no iPhone/iPad, "Touch ID" no Mac, "biometria" no resto. */
export function nomeBiometria() {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'Face ID'
  if (/Macintosh/.test(ua)) return 'Touch ID'
  if (/Windows/.test(ua)) return 'Windows Hello'
  return 'biometria'
}

/** O aparelho tem biometria disponível para o app? */
export async function biometriaDisponivel(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function bloqueioAtivo(usuarioId: string | undefined): boolean {
  if (!usuarioId) return false
  try { return !!localStorage.getItem(chave(usuarioId)) } catch { return false }
}

/** Cadastra a biometria deste aparelho e liga o bloqueio. */
export async function ativarBloqueio(usuarioId: string, email: string) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: aleatorio(),
      rp: { name: 'Paga Fácil', id: location.hostname },
      user: { id: buf(new TextEncoder().encode(usuarioId)), name: email, displayName: email },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
      attestation: 'none'
    }
  }) as PublicKeyCredential | null
  if (!cred) throw new Error('cancelado')
  localStorage.setItem(chave(usuarioId), paraB64(cred.rawId))
}

export function desativarBloqueio(usuarioId: string) {
  try { localStorage.removeItem(chave(usuarioId)) } catch { /* sem armazenamento */ }
}

/** Pede a biometria. Resolve se a pessoa foi confirmada; rejeita se cancelou ou falhou. */
export async function pedirBiometria(usuarioId: string) {
  const id = localStorage.getItem(chave(usuarioId))
  if (!id) return
  const r = await navigator.credentials.get({
    publicKey: {
      challenge: aleatorio(),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: buf(deB64(id)), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000
    }
  })
  if (!r) throw new Error('cancelado')
}
