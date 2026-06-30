const fs = require('fs');
let content = fs.readFileSync('admin/index.html', 'utf8');

const oldHtml = `<div class="flex items-center justify-between mb-8">
                            <h2 class="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                                <i data-lucide="bar-chart-3" class="w-5 h-5 text-emerald-500"></i>
                                Báo Cáo Dòng Tiền & Lợi Nhuận (Tháng <span x-text="globalProfitReport.month"></span>)
                            </h2>
                            <button @click="calculateGlobalProfit()" class="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-2">
                                <i data-lucide="refresh-cw" class="w-3 h-3"></i> Quét Lại Data
                            </button>
                        </div>`;

const newHtml = `<div class="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                            <h2 class="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                                <i data-lucide="bar-chart-3" class="w-5 h-5 text-emerald-500"></i>
                                Báo Cáo Dòng Tiền & Lợi Nhuận (Tháng <span x-text="globalProfitReport.month"></span>)
                            </h2>
                            <div class="flex items-center gap-3 w-full md:w-auto">
                                <div class="bg-gray-100 p-1 rounded-lg flex gap-1">
                                    <button @click="globalProfitFilter.type = 'month'; calculateGlobalProfit()" :class="globalProfitFilter.type === 'month' ? 'bg-white text-emerald-600 card-shadow' : 'text-gray-500 hover:text-gray-700'" class="px-3 py-1.5 rounded-md text-xs font-bold transition-all">Theo Tháng</button>
                                    <button @click="globalProfitFilter.type = 'custom'; calculateGlobalProfit()" :class="globalProfitFilter.type === 'custom' ? 'bg-white text-emerald-600 card-shadow' : 'text-gray-500 hover:text-gray-700'" class="px-3 py-1.5 rounded-md text-xs font-bold transition-all">Tùy Chọn</button>
                                </div>
                                <button @click="fetchSheetData()" class="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-2 shrink-0">
                                    <i data-lucide="refresh-cw" class="w-3 h-3" :class="isLoading ? 'animate-spin' : ''"></i> Lấy Data
                                </button>
                            </div>
                        </div>

                        <div class="bg-white rounded-xl border border-gray-100 card-shadow p-4 mb-6 flex flex-wrap items-end gap-4">
                            <template x-if="globalProfitFilter.type === 'month'">
                                <div class="w-full md:w-48">
                                    <label class="block text-xs font-bold text-gray-500 mb-1">Chọn Tháng</label>
                                    <select x-model="globalProfitFilter.month" @change="calculateGlobalProfit()" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-medium">
                                        <template x-for="m in availableMonths" :key="m">
                                            <option :value="m" x-text="'Tháng ' + m"></option>
                                        </template>
                                    </select>
                                </div>
                            </template>
                            <template x-if="globalProfitFilter.type === 'custom'">
                                <div class="flex flex-wrap items-end gap-4">
                                    <div class="w-full md:w-40">
                                        <label class="block text-xs font-bold text-gray-500 mb-1">Từ Ngày</label>
                                        <input type="date" x-model="globalProfitFilter.startDate" @change="calculateGlobalProfit()" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-medium">
                                    </div>
                                    <div class="w-full md:w-40">
                                        <label class="block text-xs font-bold text-gray-500 mb-1">Đến Ngày</label>
                                        <input type="date" x-model="globalProfitFilter.endDate" @change="calculateGlobalProfit()" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 font-medium">
                                    </div>
                                </div>
                            </template>
                        </div>`;

content = content.replace(oldHtml, newHtml);
fs.writeFileSync('admin/index.html', content);
console.log("Patched HTML");
