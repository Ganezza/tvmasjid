import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { PlayCircle, PauseCircle } from "lucide-react"; // Import icons
import { Button } from "@/components/ui/button"; // Import Button component
import { cn } from "@/lib/utils"; // Import cn utility
import { RealtimeChannel } from "@supabase/supabase-js"; // Import RealtimeChannel

interface MediaFile {
  id: string;
  title: string | null;
  file_path: string;
  file_type: "audio" | "video";
  source_type: "upload" | "youtube"; // New field
}

interface MediaPlayerDisplayProps {
  isOverlayActive: boolean; // Prop to indicate if an overlay is active (including murottal playing)
  onIsVideoPlayingChange: (isVideo: boolean) => void; // New prop to report video playing status
}

const MediaPlayerDisplay: React.FC<MediaPlayerDisplayProps> = React.memo(({ isOverlayActive, onIsVideoPlayingChange }) => {
  const [activeMedia, setActiveMedia] = useState<MediaFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false); // New state for manual play/pause
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement>(null); // Ref for YouTube iframe
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
    // Initial fetch when component mounts
    fetchActiveMedia();

    // Setup Realtime Channel only once on mount
    if (!channelRef.current) {
      const channel = supabase
        .channel('media_player_display_settings_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
          console.log('MediaPlayerDisplay: App settings change received!', payload);
          // Directly call fetchActiveMedia, it will get the latest settings
          fetchActiveMedia(); 
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'media_files' }, (payload) => {
          console.log('MediaPlayerDisplay: Media files table change received!', payload);
          // Re-fetch if the active media file itself is updated or deleted, or if a new one is inserted and no media is currently active
          // The `fetchActiveMedia` function already handles this by querying the DB.
          fetchActiveMedia(); 
        })
        .subscribe();
      channelRef.current = channel;
      console.log("MediaPlayerDisplay: Subscribed to channel 'media_player_display_settings_changes'.");
    }

    // Cleanup function to unsubscribe when component unmounts
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("MediaPlayerDisplay: Unsubscribed from channel 'media_player_display_settings_changes'.");
        channelRef.current = null;
      }
    };
  }, [fetchActiveMedia]);

  // Effect to handle playback based on isPlaying and isOverlayActive
  useEffect(() => {
    if (!activeMedia) return;

    const handlePlayback = (play: boolean) => {
      if (activeMedia.source_type === "youtube" && youtubeIframeRef.current) {
        const player = youtubeIframeRef.current;
        if (player && player.contentWindow) {
          const command = play ? 'playVideo' : 'pauseVideo';
          player.contentWindow.postMessage(
            `{"event":"command","func":"${command}","args":""}`,
            "*"
          );
          console.log(`MediaPlayerDisplay: Sent YouTube command: ${command}`);
        }
      } else {
        const mediaElement = activeMedia.file_type === "audio" ? audioRef.current : videoRef.current;
        if (mediaElement) {
          if (play) {
            mediaElement.play().catch(e => {
              console.error("Error playing media:", e);
              toast.error(`Gagal memutar media: ${e.message || "Pastikan file media valid dan diizinkan autoplay."}`);
              setIsPlaying(false); // Reset playing state on error
            });
            console.log("MediaPlayerDisplay: Media resumed.");
          } else {
            mediaElement.pause();
            console.log("MediaPlayerDisplay: Media paused.");
          }
        }
      }
    };

    if (isOverlayActive) {
      if (isPlaying) { // Only pause if it was actively playing
        handlePlayback(false); // Pause media
        console.log("MediaPlayerDisplay: Media paused due to overlay/murottal.");
      }
    } else {
      if (isPlaying) { // If supposed to be playing and no overlay
        handlePlayback(true); // Ensure media is playing
        console.log("MediaPlayerDisplay: Media resumed/continued.");
      } else {
        handlePlayback(false); // Ensure media is paused
        console.log("MediaPlayerDisplay: Media remains paused.");
      }
    }
  }, [isPlaying, isOverlayActive, activeMedia]);

  // Effect to clear media source when activeMedia changes (to prevent old media from playing)
  useEffect(() => {
    const audioEl = audioRef.current;
    const videoEl = videoRef.current;
    const youtubeIframeEl = youtubeIframeRef.current;

    // Pause and clear all media elements first
    if (audioEl) {
      audioEl.pause();
      audioEl.src = "";
    }
    if (videoEl) {
      videoEl.pause();
      videoEl.src = "";
    }
    if (youtubeIframeEl) {
      youtubeIframeEl.src = ""; // Clear YouTube iframe src
    }
    setIsPlaying(false); // Reset playing state when media changes
  }, [activeMedia]);


  // Effect to report video playing status to parent
  useEffect(() => {
    const isVideo = activeMedia?.file_type === "video";
    onIsVideoPlayingChange(isVideo && isPlaying && !isOverlayActive);
  }, [activeMedia, isPlaying, isOverlayActive, onIsVideoPlayingChange]);


  const handleMediaEnded = useCallback(() => {
    // For uploaded media, loop if isPlaying is true
    if (activeMedia?.source_type === "upload") {
      if (isPlaying) {
        if (activeMedia.file_type === "audio" && audioRef.current) {
          audioRef.current.play().catch(e => console.error("Error looping audio:", e));
        } else if (activeMedia.file_type === "video" && videoRef.current) {
          videoRef.current.play().catch(e => console.error("Error looping video:", e));
        }
      } else {
        // If not playing manually, just ensure it's paused
        if (audioRef.current) audioRef.current.pause();
        if (videoRef.current) videoRef.current.pause();
      }
    }
    // For YouTube, the loop parameter in the URL should handle looping
  }, [isPlaying, activeMedia]);

  const handleMediaError = useCallback((event: React.SyntheticEvent<HTMLMediaElement | HTMLIFrameElement, Event>) => {
    console.error("Media playback error:", event.currentTarget.error);
    let errorMessage = "Terjadi kesalahan saat memutar media.";
    // Check if it's an HTMLMediaElement error
    if ('code' in event.currentTarget.error) {
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
    } else {
      // Generic error for iframe or other cases
      errorMessage = `Kesalahan media: ${event.currentTarget.error.message || "Tidak diketahui."}`;
    }
    toast.error(errorMessage);
    setError(errorMessage);
    setActiveMedia(null); // Clear active media on error
    setIsPlaying(false); // Stop trying to play
  }, []);

  const togglePlayback = () => {
    console.log("MediaPlayerDisplay: Toggle playback button clicked.");
    if (!activeMedia) return;

    if (activeMedia.source_type === "youtube" && youtubeIframeRef.current) {
      const player = youtubeIframeRef.current;
      if (player && player.contentWindow) {
        const command = isPlaying ? 'pauseVideo' : 'playVideo';
        player.contentWindow.postMessage(
          `{"event":"command","func":"${command}","args":""}`,
          "*"
        );
        setIsPlaying(!isPlaying);
        console.log(`MediaPlayerDisplay: Sent YouTube command: ${command}. New isPlaying state: ${!isPlaying}`);
      }
    } else {
      const mediaElement = activeMedia.file_type === "audio" ? audioRef.current : videoRef.current;
      if (mediaElement) {
        if (isPlaying) {
          mediaElement.pause();
          setIsPlaying(false);
          console.log("MediaPlayerDisplay: Media paused by user.");
        } else {
          console.log("MediaPlayerDisplay: Attempting to play media...");
          mediaElement.play().then(() => {
            setIsPlaying(true);
            console.log("MediaPlayerDisplay: Media started playing successfully.");
          }).catch(e => {
            console.error("Error attempting to play media manually:", e);
            toast.error(`Gagal memutar media: ${e.message || "Terjadi kesalahan."}`);
            setIsPlaying(false);
          });
        }
      }
    }
  };

  // Determine the source URL for the media player
  const getMediaSourceUrl = useCallback(() => {
    if (!activeMedia) return "";
    if (activeMedia.source_type === "upload") {
      return supabase.storage.from('audio').getPublicUrl(activeMedia.file_path).data?.publicUrl || "";
    } else if (activeMedia.source_type === "youtube") {
      // For YouTube, file_path already contains the embed URL
      return activeMedia.file_path;
    }
    return "";
  }, [activeMedia]);

  const mediaSourceUrl = getMediaSourceUrl();

  // Determine if the current active media is a video
  const isCurrentMediaVideo = activeMedia?.file_type === "video";

  return (
    <div className={cn("bg-gray-800 bg-opacity-70 p-1 rounded-xl shadow-2xl w-full text-center flex-grow flex flex-col items-center justify-center overflow-hidden")}>
      <h3 className="text-lg md:text-xl lg:text-2xl font-bold mb-0.5 text-yellow-300">
        {activeMedia?.title || (activeMedia?.file_type === "audio" ? "Audio Diputar" : "Video Diputar")}
      </h3>
      <div className="relative w-full flex-grow flex items-center justify-center">
        {activeMedia?.source_type === "upload" && activeMedia.file_type === "audio" ? (
          <audio
            ref={audioRef}
            src={mediaSourceUrl}
            controls={false} // Hide default controls
            loop
            className="hidden" // Hide audio element, control via custom button
            onEnded={handleMediaEnded}
            onError={handleMediaError}
          />
        ) : activeMedia?.source_type === "upload" && activeMedia.file_type === "video" ? (
          <video
            ref={videoRef}
            src={mediaSourceUrl}
            controls={false} // Hide default controls
            loop
            muted // Muted by default for autoplay compatibility in some browsers
            className="w-full h-full object-contain"
            onEnded={handleMediaEnded}
            onError={handleMediaError}
          />
        ) : activeMedia?.source_type === "youtube" ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <iframe
              ref={youtubeIframeRef}
              className="w-full h-full object-contain rounded-md border border-gray-600"
              src={`${mediaSourceUrl}?autoplay=0&controls=1&modestbranding=1&rel=0&enablejsapi=1&loop=1&playlist=${mediaSourceUrl.split('/').pop()}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              onError={(e) => handleMediaError(e as React.SyntheticEvent<HTMLIFrameElement, Event>)}
            ></iframe>
          </div>
        ) : null}
        {/* Only show play/pause button if there's active media and it's not an overlay */}
        {activeMedia && !isOverlayActive && (
          <Button 
            onClick={togglePlayback} 
            className="absolute bg-blue-600/20 hover:bg-blue-700/40 text-white p-3 rounded-full shadow-lg"
            size="icon"
          >
            {isPlaying ? <PauseCircle className="h-8 w-8" /> : <PlayCircle className="h-8 w-8" />}
          </Button>
        )}
      </div>
    </div>
  );
});

export default MediaPlayerDisplay;