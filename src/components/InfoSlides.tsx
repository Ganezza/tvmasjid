import React, { useState, useEffect, useCallback, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

interface Slide {
  id: string;
  type: "text" | "image"; // Keep both types for existing data, but new data will be 'image'
  content: string; // Text or image URL
  title?: string;
  display_order: number;
}

const InfoSlides: React.FC = () => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchSlides = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("info_slides")
        .select("*")
        .order("display_order", { ascending: true });

      if (fetchError) {
        console.error("Error fetching info slides:", fetchError);
        setError("Gagal memuat slide informasi.");
        toast.error("Gagal memuat slide informasi.");
      } else {
        setSlides(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching info slides:", err);
      setError("Terjadi kesalahan saat memuat slide informasi.");
        toast.error("Terjadi kesalahan saat memuat slide informasi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlides();

    // Set up real-time listener for info_slides changes
    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('info_slides_changes_display')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'info_slides' }, (payload) => {
          console.log('Info slides change received for display!', payload);
          fetchSlides(); // Re-fetch if slides change
        })
        .subscribe();
      console.log("InfoSlides: Subscribed to channel 'info_slides_changes_display'.");
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("InfoSlides: Unsubscribed from channel 'info_slides_changes_display'.");
        channelRef.current = null;
      }
    };
  }, [fetchSlides]);

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center text-white h-[36rem] md:h-[48rem]">
        <p className="text-2xl">Memuat slide informasi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-800 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center text-white h-[36rem] md:h-[48rem]">
        <p className="text-2xl font-bold">Error:</p>
        <p className="text-xl">{error}</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center text-white h-[36rem] md:h-[48rem]">
        <p className="text-2xl text-gray-400">Tidak ada slide informasi untuk ditampilkan.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden h-[36rem] md:h-[48rem]">
      <Swiper
        spaceBetween={30}
        centeredSlides={true}
        autoplay={{
          delay: 5000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={false} // Disable navigation arrows for a cleaner look
        modules={[Autoplay, Pagination, Navigation]}
        className="mySwiper w-full h-full"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id} className="flex flex-col items-center justify-center p-4">
            {slide.title && (
              <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-yellow-300 text-center text-wrap">
                {slide.title}
              </h3>
            )}
            <div className="flex-grow flex items-center justify-center w-full h-full">
              <img
                src={slide.content}
                alt={slide.title || "Info Slide"}
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default InfoSlides;