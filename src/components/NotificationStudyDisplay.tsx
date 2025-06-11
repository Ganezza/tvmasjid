import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import { format } from "date-fns";
import { id } from "date-fns/locale"; // Import Indonesian locale for date-fns
import { RealtimeChannel } from "@supabase/supabase-js"; // Import RealtimeChannel

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

interface NotificationStudy {
  id: string;
  type: "notification" | "study" | "event";
  title: string;
  content: string;
  event_date?: string | null; // YYYY-MM-DD format
  event_time?: string | null; // HH:MM format
  display_order: number;
  created_at: string;
}

const NotificationStudyDisplay: React.FC = () => {
  const [items, setItems] = useState<NotificationStudy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = React.useRef<RealtimeChannel | null>(null); // Use useRef for the channel

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("notifications_and_studies")
        .select("*")
        .order("display_order", { ascending: true })
        .order("event_date", { ascending: true, nullsFirst: false }) // Sort by date, then time
        .order("event_time", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }); // Fallback for notifications

      if (fetchError) {
        console.error("Error fetching notifications/studies for display:", fetchError);
        setError("Gagal memuat notifikasi & kajian.");
        toast.error("Gagal memuat notifikasi & kajian.");
      } else {
        // Filter out past events/studies if they have an event_date
        const now = new Date();
        const filteredData = data?.filter(item => {
          if (item.type === "notification") return true; // Always show notifications
          if (item.event_date) {
            const eventDateTimeString = item.event_date + (item.event_time ? `T${item.event_time}:00` : 'T00:00:00');
            const eventDateTime = new Date(eventDateTimeString);
            return eventDateTime >= now; // Only show future or current events/studies
          }
          return true; // If no event_date, assume it's always relevant (e.g., general study info)
        }) || [];
        setItems(filteredData);
      }
    } catch (err) {
      console.error("Unexpected error fetching notifications/studies for display:", err);
      setError("Terjadi kesalahan saat memuat notifikasi & kajian.");
      toast.error("Terjadi kesalahan saat memuat notifikasi & kajian.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();

    // Set up real-time listener for notifications_and_studies changes
    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('notifications_and_studies_display_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications_and_studies' }, (payload) => {
          console.log('Notification/Study change received for display!', payload);
          fetchItems(); // Re-fetch if items change
        })
        .subscribe();
      console.log("NotificationStudyDisplay: Subscribed to channel 'notifications_and_studies_display_changes'.");
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("NotificationStudyDisplay: Unsubscribed from channel 'notifications_and_studies_display_changes'.");
        channelRef.current = null;
      }
    };
  }, [fetchItems]);

  if (isLoading) {
    return (
      <div className="w-full bg-gray-800 bg-opacity-70 p-4 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center text-white flex-grow">
        <p className="text-xl">Memuat notifikasi & kajian...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-red-800 bg-opacity-70 p-4 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center text-white flex-grow">
        <p className="text-xl font-bold">Error:</p>
        <p className="text-lg">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="w-full bg-gray-800 bg-opacity-70 p-4 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center text-white flex-grow">
        <p className="text-xl text-gray-400">Tidak ada notifikasi atau kajian untuk ditampilkan.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-800 bg-opacity-70 p-4 rounded-xl shadow-2xl overflow-hidden flex-grow flex flex-col">
      <Swiper
        spaceBetween={30}
        centeredSlides={true}
        autoplay={{
          delay: 7000, // Slightly longer delay for text-heavy slides
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
        }}
        navigation={false}
        modules={[Autoplay, Pagination, Navigation]}
        className="mySwiper w-full h-full"
      >
        {items.map((item) => (
          <SwiperSlide key={item.id} className="relative flex flex-col items-center justify-center p-4 text-center h-full overflow-y-auto">
            <h3 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 text-yellow-300">
              {item.type === "notification" ? "PENGUMUMAN" : item.type === "study" ? "JADWAL KAJIAN" : "ACARA KHUSUS"}
            </h3>
            <h4 className="text-2xl md:text-3xl lg:text-4xl font-semibold mb-2 text-blue-300">{item.title}</h4>
            <p className="text-xl md:text-2xl lg:text-3xl leading-relaxed text-gray-200 break-words">{item.content}</p>
            {(item.event_date || item.event_time) && (
              <p className="text-lg md:text-xl lg:text-2xl text-green-300 mt-3">
                {item.event_date && format(new Date(item.event_date), "EEEE, dd MMMM yyyy", { locale: id }).replace('Minggu', 'Ahad')}
                {item.event_date && item.event_time && " Pukul "}
                {item.event_time}
              </p>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default NotificationStudyDisplay;