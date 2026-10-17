/** Tailwind cho qlkh/chatgpt.html (giữ nguyên theme của trang cũ). */
module.exports = {
  content: ['./chatgpt.html'],
  ...{
            theme: {
                extend: {
                    colors: {
                        primary: {
                            DEFAULT: '#4318FF',
                            hover: '#3311CC',
                            light: '#F4F7FE'
                        }
                    },
                    fontFamily: {
                        sans: ['"Plus Jakarta Sans"', 'sans-serif']
                    }
                }
            }
        }
};
