/** Tailwind cho qlkh/spotify.html (giữ nguyên theme của trang cũ). */
module.exports = {
  content: ['./spotify.html'],
  ...{
            theme: {
                extend: {
                    colors: {
                        primary: {
                            DEFAULT: '#1DB954', // Spotify Green
                            hover: '#1AA34A',
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
