/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'sans-serif'], // גופן ברירת המחדל לממשק
        classic: ['"Frank Ruhl Libre"', 'serif'], // גופן קלאסי לטקסט הלימוד
      },
      colors: {
        // פלטת "כריכת ספר לימוד": ירוק כריכה, פליז, פרגמנט, וסרט סימניה
        parchment: {
          50: '#FBF6EA',
          100: '#F5EDDA',
          200: '#EAD9B4',
        },
        cover: {
          DEFAULT: '#1E3A2B',
          dark: '#142820',
          light: '#2C4E3A',
        },
        brass: {
          DEFAULT: '#A9834A',
          light: '#C7A467',
          dark: '#8B6B39',
        },
        ribbon: {
          DEFAULT: '#8B3232',
          dark: '#6E2626',
        },
        ink: '#241C14',
        hairline: '#D8CBAA',
      }
    },
  },
  plugins: [],
}