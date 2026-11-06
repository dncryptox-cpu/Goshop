"use client";

import { useState } from "react";
import { useFinanceStore, JournalEntry } from "@/store/useFinanceStore";
import { BookOpen, Plus } from "lucide-react";

export default function JournalPage() {
  const { journalEntries, addJournalEntry } = useFinanceStore();
  const [isAdding, setIsAdding] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;

    const newEntry: JournalEntry = {
      id: Math.random().toString(36).substr(2, 9),
      date,
      title,
      content,
    };
    
    addJournalEntry(newEntry);
    setTitle("");
    setContent("");
    setIsAdding(false);
  };

  return (
    <div className="p-8 pb-20 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Trading Journal</h1>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-white text-black px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-slate-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </button>
      </div>

      {isAdding && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">Date</label>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs text-slate-400 mb-1">Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Review of this week..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-slate-400 mb-1">Content</label>
              <textarea 
                value={content} 
                onChange={e => setContent(e.target.value)}
                placeholder="Write your thoughts here..."
                rows={5}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500 resize-y"
              />
            </div>
            
            <div className="flex justify-end gap-2 mt-2">
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button type="submit" className="bg-orange-600 hover:bg-orange-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">
                Save Entry
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {journalEntries.map((entry) => (
          <div key={entry.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-colors">
            <div className="flex items-center gap-2 text-orange-400 mb-3">
              <BookOpen className="w-4 h-4" />
              <span className="text-sm font-medium">{entry.date}</span>
            </div>
            <h3 className="text-xl font-bold mb-3">{entry.title}</h3>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
          </div>
        ))}
        {journalEntries.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-slate-500">
            No journal entries yet. Start writing!
          </div>
        )}
      </div>
    </div>
  );
}
