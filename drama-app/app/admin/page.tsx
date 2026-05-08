'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function AdminPage() {
  const [title, setTitle] = useState('');
  const [seriesName, setSeriesName] = useState(''); // ប្រើជាឈ្មោះ Folder
  const [isPremium, setIsPremium] = useState(false);
  const [status, setStatus] = useState('');

  // ១. បញ្ជាក់អត្តសញ្ញាណអ្នកប្រើប្រាស់ (Owner Only)
  // អ្នកអាចបន្ថែម Logic ឆែក Telegram ID នៅទីនេះ

  const handleUpload = () => {
    if (!title || !seriesName) {
      alert("សូមបំពេញចំណងជើង និងឈ្មោះរឿង (Folder) ជាមុនសិន!");
      return;
    }

    // បើកផ្ទាំង Upload របស់ Cloudinary
    (window as any).cloudinary.openUploadWidget(
      {
        cloudName: 'dckwiic88', 
        uploadPreset: 'ml_default', // ឈ្មោះ Preset ដែលអ្នកបានបង្កើត
        folder: `Dramas/${seriesName}`, // បែងចែក Folder តាមឈ្មោះរឿង
        sources: ['local', 'url'],
        resourceType: 'video',
      },
      async (error: any, result: any) => {
        if (!error && result && result.event === "success") {
          const videoUrl = result.info.secure_url;
          const thumbnailUrl = result.info.thumbnail_url || '';

          // ២. រក្សាទុកទិន្នន័យទៅក្នុង Supabase
          const { error: dbError } = await supabase
            .from('videos')
            .insert([
              { 
                title: title, 
                url: videoUrl, 
                thumbnail: thumbnailUrl,
                category: seriesName, // ប្រើឈ្មោះរឿងជា Category
                is_premium: isPremium 
              }
            ]);

          if (dbError) {
            setStatus('Error saving to database: ' + dbError.message);
          } else {
            setStatus('Upload ជោគជ័យ និងរក្សាទុកក្នុង Database រួចរាល់!');
            setTitle('');
          }
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-khmer">
      <script src="https://upload-widget.cloudinary.com/global/all.js" type="text/javascript"></script>
      
      <div className="max-w-md mx-auto bg-slate-800 p-6 rounded-xl shadow-2xl">
        <h1 className="text-2xl font-bold mb-6 text-blue-400 border-b border-slate-700 pb-2">គ្រប់គ្រងការ Upload</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">ចំណងជើងភាគ (Title)</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:outline-none focus:border-blue-500"
              placeholder="ឧទាហរណ៍៖ Ep 1 - ការចាប់ផ្ដើម"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">ឈ្មោះរឿង (Folder Name)</label>
            <input 
              type="text" 
              value={seriesName}
              onChange={(e) => setSeriesName(e.target.value)}
              className="w-full p-2 rounded bg-slate-700 border border-slate-600 focus:outline-none focus:border-blue-500"
              placeholder="ឧទាហរណ៍៖ Hear Me Mommy"
            />
          </div>

          <div className="flex items-center space-x-3 py-2">
            <input 
              type="checkbox" 
              checked={isPremium}
              onChange={(e) => setIsPremium(e.target.checked)}
              className="w-5 h-5 cursor-pointer"
            />
            <label>កំណត់ជាវីដេអូ Premium (បង់ប្រាក់ Stars)</label>
          </div>

          <button 
            onClick={handleUpload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition duration-200 mt-4"
          >
            ជ្រើសរើសវីដេអូ និង Upload
          </button>

          {status && <p className="mt-4 text-center text-sm text-green-400">{status}</p>}
        </div>
      </div>
    </div>
  );
}