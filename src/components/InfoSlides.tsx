import React, { useState, useEffect, useCallback } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
    fetchSlides(); // Initial fetch on mount

    // Setup Realtime Channel
    const channel = supabase
      .channel('info_slides_changes_display') // Unique channel name
      .on('postgres_changes', { event: '*', schema: 'public', table: 'info_slides' }, (payload) => {
        console.log('Info slides change received!', payload);
        fetchSlides(); // Re-fetch data on change
      })
      .subscribe();

    console.log("InfoSlides: Subscribed to channel 'info_slides_changes_display'.");

    // Cleanup function
    return () => {
      supabase.removeChannel(channel);
      console.log("InfoSlides: Unsubscribed from channel 'info_slides_changes_display'.");
    };
  }, [fetchSlides]); // `fetchSlides` is a stable `useCallback` with no dependencies, so this `useEffect` will only run on mount/unmount.

  if (isLoading) {
    return (
      <div className="bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center text-white flex-grow">
        <p className="text-base">Memuat slide informasi...</p> {/* Reduced font size */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-800 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center text-white flex-grow">
        <p className="text-base font-bold">Error:</p> {/* Reduced font size */}
        <p className="text-sm">{error}</p> {/* Reduced font size */}
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center text-white flex-grow">
        <p className="text-base text-gray-400">Tidak ada slide informasi untuk ditampilkan.</p> {/* Reduced font size */}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 bg-opacity-70 rounded-xl shadow-2xl overflow-hidden flex-grow flex flex-col">
      <Swiper
        spaceBetween={15} {/* Reduced from 30 */}
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
          <SwiperSlide key={slide.id} className="flex flex-col items-center justify-center p-2"> {/* Reduced padding */}
            {slide.title && (
              <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-2 text-yellow-300 text-center text-wrap"> {/* Reduced font sizes */}
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