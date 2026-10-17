/** Tailwind cho qlkh/netflix.html (giữ nguyên theme của trang cũ). */
module.exports = {
  content: ['./netflix.html'],
  ...{
            theme: {
                extend: {
                    colors: {
                        primary: {
                            DEFAULT: '#E50914', // Netflix Red
                            hover: '#B9090B',
                            light: '#F4F7FE'
                        }
                    },
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                        mono: ['"JetBrains Mono"', 'monospace']
                    }
                }
            }
        }
};
