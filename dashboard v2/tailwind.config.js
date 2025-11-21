export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        terminal: {
          green: '#8b9d83',
          'green-dim': '#6b7d63',
          black: '#1a1d1a',
          gray: '#252825',
          'light-gray': '#2f332f',
          border: '#3a3d3a',
          text: '#c5d0c0'
        }
      },
      fontFamily: {
        mono: ['Space Mono', 'monospace'],
        sans: ['Inter', 'sans-serif']
      }
    }
  }
}