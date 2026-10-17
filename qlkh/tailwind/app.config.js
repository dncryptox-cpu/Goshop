/** Tailwind cho qlkh/index.html (cùng theme với admin cũ). */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: { primary: '#1890ff', 'primary-light': '#e6f7ff', 'primary-dark': '#096dd9', secondary: '#262626', accent: '#f5222d', 'bg-soft': '#f4f7fe' },
      borderRadius: { xl: '12px', '2xl': '16px' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      spacing: { '4.5': '1.125rem' },
    },
  },
};
