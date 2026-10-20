/** Superficies azul noche, acentos verde agua y texto de alto contraste. */
export const colors = {
  primary: '#79DDCA',
  primaryDark: '#369F91',
  primarySoft: '#183D40',
  accent: '#A5D5F4',
  accentSoft: '#20394D',
  background: '#0C1B24',
  backgroundDeep: '#08141B',
  surface: '#142A35',
  surfaceRaised: '#1D3642',
  surfaceHover: '#1A3340',
  text: '#EAF3F5',
  muted: '#B6C9D1',
  border: '#3C5866',
  borderSoft: '#29444F',
  inputBorder: '#72909D',
  danger: '#FFADB5',
  dangerSoft: '#442B36',
  warning: '#F2D391',
  warningSoft: '#3D3527',
  success: '#93DFC0',
  ai: '#B7C9F4',
  aiSoft: '#29384D'
};

/** Degradados de la marca: verde agua hacia azul cielo, como el logotipo. */
export const gradients = {
  primary: 'linear-gradient(135deg, #8DE6D5 0%, #79DDCA 48%, #93D5EC 100%)',
  danger: 'linear-gradient(135deg, #FFC0C6 0%, #FFADB5 100%)',
  hero: 'linear-gradient(135deg, #1C4A49 0%, #173B41 50%, #1C3551 100%)',
  ai: 'linear-gradient(135deg, #2E3F5B 0%, #273752 55%, #1F3448 100%)',
  warning: 'linear-gradient(135deg, #443A27 0%, #3A3427 100%)',
  primaryTile: 'linear-gradient(135deg, #1F4E4D 0%, #183D40 100%)',
  accentTile: 'linear-gradient(135deg, #264660 0%, #20394D 100%)',
  aiTile: 'linear-gradient(135deg, #34456A 0%, #29384D 100%)',
  warningTile: 'linear-gradient(135deg, #4A3F2A 0%, #3D3527 100%)',
  avatar: 'linear-gradient(135deg, #79DDCA 0%, #A5D5F4 100%)',
  ambient: 'radial-gradient(ellipse at 15% 0%, rgba(121, 221, 202, 0.13) 0%, rgba(121, 221, 202, 0) 55%), radial-gradient(ellipse at 95% 0%, rgba(165, 213, 244, 0.09) 0%, rgba(165, 213, 244, 0) 45%)'
};

export const shadows = {
  card: '0px 14px 34px -20px rgba(0, 0, 0, 0.75)',
  raised: '0px 22px 48px -22px rgba(0, 0, 0, 0.85)',
  primary: '0px 12px 26px -14px rgba(121, 221, 202, 0.65)',
  focus: '0px 0px 0px 4px rgba(121, 221, 202, 0.2)'
};

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold'
} as const;
