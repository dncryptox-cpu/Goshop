/** Tailwind cho qlkh/googleone.html (giữ nguyên theme của trang cũ). */
module.exports = {
  content: ['./googleone.html'],
  ...{
            theme: {
                extend: {
                    colors: {
                        primary: {
                            DEFAULT: '#4285F4', // Google Blue
                            hover: '#3367D6',
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
