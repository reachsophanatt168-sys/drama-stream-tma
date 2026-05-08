'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { Play, RefreshCcw, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { triggerHaptic, shareVideo } from './admin/telegram';
import SkeletonLoader from './admin/SkeletonLoader';

const formatNumber = (num: number) => {
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
};

export default function DramaFeed() {
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [unlockedVideoIds, setUnlockedVideoIds] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number; rotate: number }[]>([]);
  const tapTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      // ទាញយកតែទិន្នន័យដែលចាំបាច់ និងកំណត់ត្រឹម ១០ វីដេអូដំបូងដើម្បីឲ្យលឿន
      const { data, error } = await supabase.from('videos')
        .select('id, title, url, likes, is_premium')
        .order('created_at', { ascending: false })
        .range(0, 9); // ស្មើនឹងទាញយក ១០ វីដេអូដំបូង
      if (error) throw error;
      setVideos(data || []);
      setHasMore((data || []).length === 10);
    } catch (err) {
      console.error("Failed to load videos", err);
      WebApp.showAlert("Failed to load videos. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // អនុគមន៍សម្រាប់ទាញយកវីដេអូបន្តពេលអូសដល់ក្រោម
  const fetchMoreVideos = useCallback(async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    try {
      const currentLength = videos.length;
      const { data, error } = await supabase.from('videos')
        .select('id, title, url, likes, is_premium')
        .order('created_at', { ascending: false })
        .range(currentLength, currentLength + 9); // ទាញយក ១០ វីដេអូបន្ទាប់
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        setVideos((prev) => [...prev, ...data]); // បន្ថែមវីដេអូថ្មីចូលទៅកាន់បញ្ជីចាស់
      }
      
      if (!data || data.length < 10) {
        setHasMore(false); // បើវីដេអូទាញមកបានតិចជាង ១០ មានន័យថាអស់វីដេអូហើយ
      }
    } catch (err) {
      console.error("Failed to fetch more videos", err);
    } finally {
      setIsFetchingMore(false);
    }
  }, [videos.length, isFetchingMore, hasMore]);

  // អនុគមន៍សម្រាប់ពេលចុចប៊ូតុងបង់ប្រាក់
  const handleUnlockPremium = useCallback(async (videoId: string) => {
    triggerHaptic('heavy');
    const userId = WebApp.initDataUnsafe?.user?.id;

    if (!userId) {
      WebApp.showAlert("Could not verify user. Please try again.");
      return;
    }

    // នេះគឺជាការទូទាត់សាកល្បង។ ក្នុងកម្មវិធីពិតប្រាកដ អ្នកនឹងបើក Invoice។
    // ពេលទូទាត់ជោគជ័យ (តាមរយៈ webhook) ទើបអ្នកបញ្ចូលទៅក្នុង DB។
    // ក្នុងឧទាហរណ៍នេះ យើងបញ្ចូលដោយផ្ទាល់ពេលអ្នកប្រើប្រាស់ចុច។
    const { error } = await supabase.from('purchases').insert({ user_id: userId, video_id: videoId });

    if (error && error.code !== '23505') { // 23505 គឺ unique_violation មានន័យថាគាត់ធ្លាប់ទិញរួចហើយ យើងអាចរំលងបាន
      WebApp.showAlert("Payment failed. Please try again.");
    } else {
      WebApp.showAlert("Payment successful! Video unlocked.");
      // ដោះសោរវីដេអូភ្លាមៗនៅក្នុង UI
      setUnlockedVideoIds(prev => new Set(prev).add(videoId));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      WebApp.ready();
      WebApp.expand();
    }
    fetchVideos();

    // ទាញយកវីដេអូដែលអ្នកប្រើប្រាស់បានទិញរួច
    const userId = WebApp.initDataUnsafe?.user?.id;
    if (userId) {
      supabase.from('purchases').select('video_id').eq('user_id', userId)
        .then(({ data }) => {
          if (data) {
            setUnlockedVideoIds(new Set(data.map(p => p.video_id)));
          }
        });
    }
  }, [fetchVideos]);

  // Intersection Observer for Performance Autoplay
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target.querySelector('video');
          if (!video) return;

          if (entry.isIntersecting) {
            const isPremium = video.dataset.isPremium === 'true';
            const isUnlocked = unlockedVideoIds.has(video.dataset.videoId || '');
            if (isPremium && !isUnlocked) {
              setIsPlaying(false); // មិនឲ្យលេងទេ បើជា Premium
            } else {
              video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
            }
            setActiveIndex(Number((entry.target as HTMLElement).dataset.index));
          } else {
            video.pause();
            video.currentTime = 0;
          }
        });
      },
      { threshold: 0.6 }
    );

    const elements = document.querySelectorAll('.video-snap-item');
    elements.forEach((el) => observer.observe(el));

    return () => {
      elements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [videos]);

  // Intersection Observer សម្រាប់កំណត់ចំណាំពេលអូសដល់ក្រោមគេ (Infinite Scroll)
  useEffect(() => {
    if (isLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          fetchMoreVideos();
        }
      },
      { threshold: 0.1 }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [isLoading, hasMore, fetchMoreVideos]);

  if (isLoading) {
    return <SkeletonLoader />;
  }

  return (
    <main className="relative h-screen w-full bg-[var(--tg-theme-bg-color,#000)] overflow-y-scroll snap-y snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      
      {/* Pull to Refresh Button */}
      <button 
        onClick={() => { triggerHaptic('rigid'); fetchVideos(); }}
        className="absolute top-4 right-4 z-50 bg-black/40 p-3 rounded-full backdrop-blur-md text-white"
      >
        <RefreshCcw className="w-5 h-5" />
      </button>

        {videos.map((video, index) => {
          const isUnlocked = unlockedVideoIds.has(video.id);
          const showPremiumLock = video.is_premium && !isUnlocked;

          return (
          <div key={video.id} data-index={index} className="video-snap-item relative h-screen w-full snap-start snap-always bg-[var(--tg-theme-secondary-bg-color,#111)]">
            {/* Video Player */}
            <video 
              ref={(el) => {
                videoRefs.current[index] = el;
              }}
              src={video.url} 
              autoPlay={index === 0 && !showPremiumLock} // លេងវីដេអូទី១ លុះត្រាតែមិនមែនជា Premium
              className="h-full w-full object-cover"
              data-is-premium={video.is_premium}
              data-video-id={video.id}
              loop
              preload={index <= activeIndex + 1 ? "auto" : "none"} // Lazy Loading memory optimization
              playsInline
              onClick={(e) => {
                const videoElement = e.currentTarget;
                const clientX = e.clientX;
                const clientY = e.clientY;

                if (showPremiumLock) return; // មិនឲ្យចុច Play/Pause ឬ Like បើវីដេអូត្រូវបាន Lock

                if (tapTimeout.current) {
                  // Double Tap Detected
                  clearTimeout(tapTimeout.current);
                  tapTimeout.current = null;
                  
                  // Telegram Haptic Feedback on Like
                  triggerHaptic('heavy');

                  setHearts((prev) => [
                    ...prev, 
                    { id: Date.now(), x: clientX, y: clientY, rotate: Math.random() * 40 - 20 } // Random tilt
                  ]);

                  // Persist Like to Supabase
                  const newLikes = (video.likes || 0) + 1;
                  setVideos((prev) => prev.map(v => v.id === video.id ? { ...v, likes: newLikes } : v));
                  supabase.from('videos').update({ likes: newLikes }).eq('id', video.id).catch(console.error);
                } else {
                  // Single Tap
                  tapTimeout.current = setTimeout(() => {
                    tapTimeout.current = null;
                    triggerHaptic('light'); // Subtle feedback on play/pause
                    if (videoElement.paused) {
                      videoElement.play();
                      setIsPlaying(true);
                    } else {
                      videoElement.pause();
                      setIsPlaying(false);
                    }
                  }, 250); // Wait 250ms to see if another tap happens
                }
              }}
              muted // បន្ថែម muted ដើម្បីឱ្យវា Auto-play បានលើគ្រប់ Browser
            />

            {/* ផ្ទាំង Premium Overlay */}
            {showPremiumLock && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 backdrop-blur-xl p-6 text-center">
                <Lock className="w-16 h-16 text-yellow-400 mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2 font-khmer">វីដេអូ Premium</h3>
                <p className="text-gray-300 mb-6 text-sm font-khmer">សូមបង់ប្រាក់ដោយប្រើ Telegram Stars ដើម្បីទស្សនាភាគនេះ។</p>
                <button
                  onClick={() => handleUnlockPremium(video.id)}
                  className="bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-bold py-3 px-8 rounded-full shadow-lg flex items-center gap-2 transition-transform active:scale-95"
                >
                  <span className="text-lg">⭐ 50 Stars</span>
                </button>
              </div>
            )}

            {/* Play Button Overlay */}
            {index === activeIndex && !isPlaying && !showPremiumLock && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="bg-black/40 rounded-full p-5 backdrop-blur-sm transition-opacity duration-300">
                  <Play className="w-14 h-14 text-white ml-2 opacity-90" fill="currentColor" />
                </div>
              </div>
            )}

            {/* UI Overlays (Like, Share, Title) */}
            <div className="absolute bottom-10 left-4 z-10 text-white p-4 bg-gradient-to-t from-black/60 to-transparent w-full">
              <h2 className="text-xl font-bold font-khmer mb-1">{video.title}</h2>
              <p className="text-sm opacity-80">អូសឡើងលើដើម្បីមើលរឿងបន្ទាប់</p>
            </div>

            {/* Right Side Buttons (UI Mockup) */}
            <div className="absolute right-4 bottom-24 flex flex-col space-y-6 text-white z-10">
              <div className="flex flex-col items-center">
                <span className="text-2xl">❤️</span>
                <span className="text-xs">{formatNumber(video.likes || 0)}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl">💬</span>
                <span className="text-xs">45</span>
              </div>
              <div className="flex flex-col items-center" onClick={() => shareVideo(video.url, video.title)}>
                <span className="text-2xl">🔗</span>
                <span className="text-xs">Share</span>
              </div>
            </div>
          </div>
        )
        })}

      {/* កន្លែងបង្ហាញ Spinner ពេលកំពុងទាញយកវីដេអូបន្ថែមនៅខាងក្រោមគេ */}
      {hasMore && (
        <div ref={sentinelRef} className="h-screen w-full snap-start flex items-center justify-center bg-[var(--tg-theme-secondary-bg-color,#111)]">
          {isFetchingMore && <div className="w-10 h-10 border-4 border-slate-600 border-t-white rounded-full animate-spin"></div>}
        </div>
      )}

      {/* Floating Hearts Overlay */}
      <AnimatePresence>
        {hearts.map((heart) => (
          <motion.div
            key={heart.id}
            initial={{ opacity: 1, scale: 0, y: heart.y - 32, x: heart.x - 32, rotate: heart.rotate }}
            animate={{ opacity: 0, scale: 1.5, y: heart.y - 150 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute pointer-events-none z-50 text-red-500 drop-shadow-lg"
            onAnimationComplete={() => setHearts((prev) => prev.filter((h) => h.id !== heart.id))}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </motion.div>
        ))}
      </AnimatePresence>
    </main>
  );
}