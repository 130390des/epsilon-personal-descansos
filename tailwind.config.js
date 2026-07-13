/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        epsilon: {
          lime: '#7ec900',
          limeSoft: '#edf9d6',
          teal: '#00637f',
          tealDark: '#003e5b',
          ink: '#071b3a',
          muted: '#516078',
        },
      },
      boxShadow: {
        panel: '0 10px 30px rgba(7, 27, 58, 0.08)',
      },
    },
  },
  plugins: [],
};
