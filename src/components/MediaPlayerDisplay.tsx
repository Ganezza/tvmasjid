import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";
import { PlayCircle, PauseCircle } from "lucide-react"; // Import icons
import { Button } from "@/components/ui/button"; // Import Button component

interface MediaFile {
  id: string;
  title: string | null;
  file_path: string;
  file_type: "audio" | "video";
}

interface MediaPlayerDisplayProps {
  isOverlayActive: boolean; // Prop to indicate if an overlay is active (including murottal playing)
}

const MediaPlayerDisplay: React.FC<MediaPlayerDisplayProps> = React.memo(({ isOverlayActive }) => {
  const [activeMedia, setActiveMedia] = useState<MediaFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false); // New state for manual play/pause
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchActiveMedia = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log("MediaPlayerDisplay: Starting fetchActiveMedia...");
    try {
      // 1. Fetch active_media_id from app_settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("app_settings")
        .select("active_media_id")
        .eq("id", 1)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error("MediaPlayerDisplay: Error fetching active_media_id:", settingsError);
        setError(`Gagal memuat pengaturan media aktif: ${settingsError.message}`);
        setActiveMedia(null);
        setIsLoading(false);
        return;
      }

      const activeMediaId = settingsData?.active_media_id;
      console.log("MediaPlayerDisplay: Fetched active_media_id:", activeMediaId);

      if (!activeMediaId) {
        console.log("MediaPlayerDisplay: No active media ID found in app_settings.");
        setActiveMedia(null);
        setIsLoading(false);
        return;
      }

      // 2. Fetch media details using active_media_id
      const { data: mediaData, error: mediaError } = await supabase
        .from("media_files")
        .select("*")
        .eq("id", activeMediaId)
        .single();

      if (mediaError) {
        console.error("MediaPlayerDisplay: Error fetching active media details:", mediaError);
        setError(`Gagal memuat detail media aktif: ${mediaError.message}`);
        setActiveMedia(null);
      } else if (mediaData) {
        console.log("MediaPlayerDisplay: Fetched active media details:", mediaData);
        setActiveMedia(mediaData);
      } else {
        console.log("MediaPlayerDisplay: Active media ID found, but no corresponding media file.");
        setActiveMedia(null); // Media not found
        setError("Media aktif tidak ditemukan atau sudah dihapus.");
      }
    } catch (err: any) {
      console.error("MediaPlayerDisplay: Unexpected error fetching active media:", err);
      setError(`Terjadi kesalahan saat memuat media: ${err.message}`);
      setActiveMedia(null);
    } finally {
      setIsLoading(false);
      console.log("MediaPlayerDisplay: fetchActiveMedia finished. isLoading:", false);
    }
  }, []);

  useEffect(() => {
    fetchActiveMedia();

    // Setup Realtime Channel for app_settings changes (specifically active_media_id)
    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('media_player_display_settings_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
          console.log('MediaPlayerDisplay: App settings change received!', payload);
          fetchActiveMedia(); // Re-fetch if active_media_id changes
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'media_files' }, (payload) => {
          console.log('MediaPlayerDisplay: Media files table change received!', payload);
          // If the active media file itself is updated or deleted, re-fetch
          if (activeMedia && (payload.new?.id === activeMedia.id || payload.old?.id === activeMedia.id)) {
            fetchActiveMedia();
          } else if (!activeMedia && payload.eventType === 'INSERT') {
            // If no active media, but a new one is inserted, check if it becomes active
            fetchActiveMedia();
          }
        })
        .subscribe();
      console.log("MediaPlayerDisplay: Subscribed to channel 'media_player_display_settings_changes'.");
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("MediaPlayerDisplay: Unsubscribed from channel 'media_player_display_settings_changes'.");
        channelRef.current = null;
      }
    };
  }, [fetchActiveMedia, activeMedia]); // Add activeMedia to dependencies to re-evaluate subscription if activeMedia changes

  // Effect to handle playback based on isPlaying and isOverlayActive
  useEffect(() => {
    const mediaElement = activeMedia?.file_type === "audio" ? audioRef.current : videoRef.current;

    if (!mediaElement) return;

    if (isOverlayActive) {
      if (!mediaElement.paused) {
        mediaElement.pause();
        console.log("MediaPlayerDisplay: Media paused due to overlay/murottal.");
      }
    } else {
      if (isPlaying && mediaElement.paused) {
        mediaElement.play().catch(e => {
          console.error("Error playing media:", e);
          toast.error(`Gagal memutar media: ${e.message || "Pastikan file media valid dan diizinkan autoplay."}`);
          setIsPlaying(false); // Reset playing state on error
        });
        console.log("MediaPlayerDisplay: Media resumed.");
      } else if (!isPlaying && !mediaElement.paused) {
        mediaElement.pause();
        console.log("MediaPlayerDisplay: Media paused by user or no longer intended to play.");
      }
    }
  }, [isPlaying, isOverlayActive, activeMedia]);

  // Effect to set media source when activeMedia changes
  useEffect(() => {
    const audioEl = audioRef.current;
    const videoEl = videoRef.current;

    // Pause and clear all media elements first
    if (audioEl) {
      audioEl.pause();
      audioEl.src = "";
    }
    if (videoEl) {
      videoEl.pause();
      videoEl.src = "";
    }
    setIsPlaying(false); // Reset playing state when media changes

    if (activeMedia) {
      const publicUrl = supabase.storage.from('audio').getPublicUrl(activeMedia.file_path).data?.publicUrl;
      console.log("MediaPlayerDisplay: Active media changed. Public URL:", publicUrl);
      if (!publicUrl) {
        setError("URL media tidak ditemukan.");
        return;
      }

      if (activeMedia.file_type === "audio" && audioEl) {
        audioEl.src = publicUrl;
        audioEl.load();
      } else if (activeMedia.file_type === "video" && videoEl) {
        videoEl.src = publicUrl;
        videoEl.load();
      }
    }
  }, [activeMedia]);


  const handleMediaEnded = useCallback(() => {
    // Loop the current media only if it was manually started
    if (isPlaying) {
      if (activeMedia?.file_type === "audio" && audioRef.current) {
        audioRef.current.play().catch(e => console.error("Error looping audio:", e));
      } else if (activeMedia?.file_type === "video" && videoRef.current) {
        videoRef.current.play().catch(e => console.error("Error looping video:", e));
      }
    } else {
      // If not playing manually, just ensure it's paused
      if (audioRef.current) audioRef.current.pause();
      if (videoRef.current) videoRef.current.pause();
    }
  }, [isPlaying, activeMedia]);

  const handleMediaError = useCallback((event: React.SyntheticEvent<HTMLMediaElement, Event>) => {
    console.error("Media playback error:", event.currentTarget.error);
    let errorMessage = "Terjadi kesalahan saat memutar media.";
    if (event.currentTarget.error) {
      switch (event.currentTarget.error.code) {
        case event.currentTarget.error.MEDIA_ERR_ABORTED:
          errorMessage = "Pemutaran media dibatalkan.";
          break;
        case event.currentTarget.error.MEDIA_ERR_NETWORK:
          errorMessage = "Kesalahan jaringan saat memuat media.";
          break;
        case event.currentTarget.error.MEDIA_ERR_DECODE:
          errorMessage = "Kesalahan dekode media. Format tidak didukung?";
          break;
        case event.currentTarget.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = "Sumber media tidak didukung atau tidak ditemukan.";
          break;
        default:
          errorMessage = "Kesalahan media tidak diketahui.";
      }
    }
    toast.error(errorMessage);
    setError(errorMessage);
    setActiveMedia(null); // Clear active media on error
    setIsPlaying(false); // Stop trying to play
  }, []);

  const togglePlayback = () => {
    console.log("MediaPlayerDisplay: Toggle playback button clicked."); // Log when button is clicked
    const mediaElement = activeMedia?.file_type === "audio" ? audioRef.current : videoRef.current;
    if (mediaElement) {
      if (isPlaying) {
        mediaElement.pause();
        setIsPlaying(false);
        console.log("MediaPlayerDisplay: Media paused by user."); // Log when paused
      } else {
        console.log("MediaPlayerDisplay: Attempting to play media..."); // Log when play is attempted
        mediaElement.play().then(() => {
          setIsPlaying(true);
          console.log("MediaPlayerDisplay: Media started playing successfully."); // Log when play succeeds
        }).catch(e => {
          console.error("Error attempting to play media manually:", e);
          toast.error(`Gagal memutar media: ${e.message || "Terjadi kesalahan."}`);
          setIsPlaying(false);
        });
      }
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col items-center justify-center">
        <p className="text-sm">Memuat media player...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col items-center justify-center">
        <p className="text-sm font-bold">Error Media:</p>
        <p className="text-xs">{error}</p>
        <p className="text-xs mt-0.5">Silakan periksa pengaturan di <a href="/admin" className="underline text-blue-300">Admin Panel</a>.</p>
      </div>
    );
  }

  if (!activeMedia) {
    return (
      <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col items-center justify-center">
        <p className="text-sm text-gray-400">Tidak ada media yang dipilih untuk diputar.</p>
        <p className="text-xs text-gray-400 mt-0.5">Pilih media di <a href="/admin" className="underline text-blue-300">Admin Panel</a>.</p>
      </div>
    );
  }

  // Define publicUrl here, after activeMedia is confirmed to exist
  const publicUrl = supabase.storage.from('audio').getPublicUrl(activeMedia.file_path).data?.publicUrl;

  if (!publicUrl) {
    return (
      <div className="bg-red-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center text-white flex-grow flex flex-col items-center justify-center">
        <p className="text-sm font-bold">Error:</p>
        <p className="text-xs">URL media tidak valid atau tidak dapat diakses.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 p-2 rounded-xl shadow-2xl w-full text-center flex-grow flex flex-col items-center justify-center overflow-hidden">
      <h3 className="text-lg md:text-xl lg:text-2xl font-bold mb-1 text-yellow-300">
        {activeMedia.title || (activeMedia.file_type === "audio" ? "Audio Diputar" : "Video Diputar")}
      </h3>
      <div className="relative w-full flex-grow flex items-center justify-center">
        {activeMedia.file_type === "audio" ? (
          <audio
            ref={audioRef}
            src={publicUrl}
            controls={false} // Hide default controls
            loop
            className="hidden" // Hide audio element, control via custom button
            onEnded={handleMediaEnded}
            onError={handleMediaError}
          />
        ) : (
          <video
            ref={videoRef}
            src={publicUrl}
            controls={false} // Hide default controls
            loop
            muted // Muted by default for autoplay compatibility in some browsers
            className="w-full h-full object-contain"
            onEnded={handleMediaEnded}
            onError={handleMediaError}
          />
        )}
        <Button 
          onClick={togglePlayback} 
          className="absolute bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg"
          size="icon"
        >
          {isPlaying ? <PauseCircle className="h-8 w-8" /> : <PlayCircle className="h-8 w-8" />}
        </Button>
      </div>
      {!isPlaying && !isOverlayActive && (
        <p className="text-xs text-gray-400 mt-2">
          Klik tombol <PlayCircle className="inline-block h-3 w-3 relative -top-0.5" /> untuk memutar media.
        </p>
      )}
      {activeMedia.file_type === "video" && (
        <p className="text-xs text-gray-400 mt-1">
          Catatan: Video mungkin dimulai dalam mode 'mute' karena batasan browser untuk autoplay.
        </p>
      )}
    </div>
  );
});

export default MediaPlayerDisplay;