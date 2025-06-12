import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, Edit, PlusCircle, PlayCircle, CheckCircle } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { RealtimeChannel } from "@supabase/supabase-js";

interface MediaFile {
  id: string;
  created_at: string;
  title: string | null;
  file_path: string;
  file_type: "audio" | "video";
  display_order: number;
}

const mediaFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(100, "Judul terlalu panjang.").nullable().optional(),
  file: z.any().optional(), // For file input
  file_type: z.enum(["audio", "video"], { message: "Tipe file tidak valid." }).optional(),
  display_order: z.coerce.number().int().min(0, "Urutan tampilan harus non-negatif.").default(0),
});

type MediaFormValues = z.infer<typeof mediaFormSchema>;

const MediaPlayerSettings: React.FC = () => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaFile | null>(null);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const settingsChannelRef = useRef<RealtimeChannel | null>(null);

  const form = useForm<MediaFormValues>({
    resolver: zodResolver(mediaFormSchema),
    defaultValues: {
      title: "",
      file_type: "audio",
      display_order: 0,
    },
  });

  const { handleSubmit, register, setValue, reset, formState: { isSubmitting, errors } } = form;

  const fetchMediaAndSettings = useCallback(async () => {
    try {
      // Fetch active media ID from app_settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("app_settings")
        .select("active_media_id")
        .eq("id", 1)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error("Error fetching active media ID:", settingsError);
        toast.error("Gagal memuat pengaturan media aktif.");
      } else if (settingsData) {
        setActiveMediaId(settingsData.active_media_id);
      } else {
        setActiveMediaId(null);
      }

      // Fetch all media files
      const { data, error } = await supabase
        .from("media_files")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching media files:", error);
        toast.error("Gagal memuat file media.");
      } else {
        setMediaFiles(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching media files and settings:", err);
      toast.error("Terjadi kesalahan saat memuat data media.");
    }
  }, []);

  useEffect(() => {
    fetchMediaAndSettings();

    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('media_files_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'media_files' }, (payload) => {
          console.log('Media file change received!', payload);
          fetchMediaAndSettings();
        })
        .subscribe();
      console.log("MediaPlayerSettings: Subscribed to channel 'media_files_changes'.");
    }

    if (!settingsChannelRef.current) {
      settingsChannelRef.current = supabase
        .channel('app_settings_media_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
          console.log('App settings media change received!', payload);
          setActiveMediaId(payload.new.active_media_id);
        })
        .subscribe();
      console.log("MediaPlayerSettings: Subscribed to channel 'app_settings_media_changes'.");
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("MediaPlayerSettings: Unsubscribed from channel 'media_files_changes'.");
        channelRef.current = null;
      }
      if (settingsChannelRef.current) {
        supabase.removeChannel(settingsChannelRef.current);
        console.log("MediaPlayerSettings: Unsubscribed from channel 'app_settings_media_changes'.");
        settingsChannelRef.current = null;
      }
    };
  }, [fetchMediaAndSettings]);

  const handleAddMedia = () => {
    setEditingMedia(null);
    reset({ title: "", file: undefined, file_type: "audio", display_order: 0 });
    setIsDialogOpen(true);
  };

  const handleEditMedia = (media: MediaFile) => {
    setEditingMedia(media);
    reset({
      id: media.id,
      title: media.title || "",
      file_type: media.file_type,
      display_order: media.display_order,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteMedia = async (media: MediaFile) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus media ini? Ini juga akan menghapus file dari penyimpanan.")) {
      return;
    }

    const deleteToastId = toast.loading("Menghapus media...");

    try {
      // Delete from storage first
      const urlParts = media.file_path.split('/');
      const fileNameWithFolder = urlParts.slice(urlParts.indexOf('audio') + 1).join('/'); // Assuming 'audio' bucket
      
      const { error: storageError } = await supabase.storage
        .from('audio') // Use 'audio' bucket for media
        .remove([fileNameWithFolder]);

      if (storageError) {
        console.warn("Failed to delete file from storage:", storageError);
        // Don't throw, proceed to delete from DB even if storage fails
      }

      // Then delete from database
      const { error: dbError } = await supabase
        .from("media_files")
        .delete()
        .eq("id", media.id);

      if (dbError) {
        throw dbError;
      }

      // If the deleted media was the active one, clear active_media_id
      if (activeMediaId === media.id) {
        await supabase
          .from("app_settings")
          .upsert({ id: 1, active_media_id: null }, { onConflict: "id" });
      }

      toast.success("Media berhasil dihapus!", { id: deleteToastId });
      fetchMediaAndSettings();
    } catch (error: any) {
      console.error("Error deleting media:", error);
      toast.error(`Gagal menghapus media: ${error.message}`, { id: deleteToastId });
    }
  };

  const handleSetAsActive = async (mediaId: string) => {
    const setAsActiveToastId = toast.loading("Mengatur media aktif...");
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ id: 1, active_media_id: mediaId }, { onConflict: "id" });

      if (error) {
        throw error;
      }
      toast.success("Media berhasil diatur sebagai aktif!", { id: setAsActiveToastId });
      setActiveMediaId(mediaId); // Optimistic update
    } catch (error: any) {
      console.error("Error setting active media:", error);
      toast.error(`Gagal mengatur media aktif: ${error.message}`, { id: setAsActiveToastId });
    }
  };

  const onSubmit = async (values: MediaFormValues) => {
    let filePath = editingMedia?.file_path || null;
    let fileType = editingMedia?.file_type || values.file_type;

    if (values.file && values.file.length > 0) {
      const file = values.file[0];
      const fileExtension = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      filePath = `media/${fileName}`; // Store in 'media' subfolder within 'audio' bucket

      const uploadToastId = toast.loading("Mengunggah file media...");

      try {
        const { data, error } = await supabase.storage
          .from('audio') // Use 'audio' bucket for all media
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          throw error;
        }

        // Determine file type based on MIME type or extension
        if (file.type.startsWith('audio/')) {
          fileType = 'audio';
        } else if (file.type.startsWith('video/')) {
          fileType = 'video';
        } else {
          throw new Error("Tipe file tidak didukung. Hanya audio dan video.");
        }

        toast.success("File media berhasil diunggah!", { id: uploadToastId });
      } catch (error: any) {
        console.error("Error uploading file:", error);
        toast.error(`Gagal mengunggah file: ${error.message}`, { id: uploadToastId });
        return; // Stop submission if upload fails
      }
    }

    if (!filePath || !fileType) {
      toast.error("File media atau tipe file tidak valid.");
      return;
    }

    const payload = {
      title: values.title || null,
      file_path: filePath,
      file_type: fileType,
      display_order: values.display_order,
    };

    if (editingMedia) {
      const { error } = await supabase
        .from("media_files")
        .update(payload)
        .eq("id", editingMedia.id);

      if (error) {
        console.error("Error updating media:", error);
        toast.error("Gagal memperbarui media.");
      } else {
        toast.success("Media berhasil diperbarui!");
        setIsDialogOpen(false);
        fetchMediaAndSettings();
      }
    } else {
      const { error } = await supabase
        .from("media_files")
        .insert(payload);

      if (error) {
        console.error("Error adding media:", error);
        toast.error("Gagal menambahkan media.");
      } else {
        toast.success("Media berhasil ditambahkan!");
        setIsDialogOpen(false);
        fetchMediaAndSettings();
      }
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700 col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Media Player</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Kelola file audio/video yang akan diputar di layar utama.</p>
        <Button onClick={handleAddMedia} className="w-full bg-green-600 hover:bg-green-700 text-white mb-4">
          <PlusCircle className="mr-2 h-4 w-4" /> Tambah Media Baru
        </Button>

        <div className="space-y-3">
          {mediaFiles.length === 0 ? (
            <p className="text-gray-400 text-center">Belum ada file media. Tambahkan yang pertama!</p>
          ) : (
            mediaFiles.map((media) => (
              <div key={media.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm">
                <div className="flex-grow mr-2">
                  <p className="font-medium text-lg text-blue-200">{media.title || "(Tanpa Judul)"}</p>
                  <p className="text-sm text-gray-300">Tipe: {media.file_type} | Urutan: {media.display_order}</p>
                  <p className="text-xs text-gray-400 truncate">{media.file_path}</p>
                </div>
                <div className="flex space-x-2 items-center">
                  {activeMediaId === media.id ? (
                    <span className="text-green-400 flex items-center text-sm">
                      <CheckCircle className="h-4 w-4 mr-1" /> Aktif
                    </span>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleSetAsActive(media.id)} 
                      className="text-purple-400 border-purple-400 hover:bg-purple-400 hover:text-white"
                    >
                      Set Aktif
                    </Button>
                  )}
                  <Button variant="outline" size="icon" onClick={() => handleEditMedia(media)} className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-white">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDeleteMedia(media)} className="text-red-400 border-red-400 hover:bg-red-400 hover:text-white">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-gray-800 text-white border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-blue-300">{editingMedia ? "Edit Media" : "Tambah Media Baru"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-gray-300">Judul (Opsional)</Label>
                <Input
                  id="title"
                  {...register("title")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Judul media (mis: Video Kajian)"
                />
                {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <Label htmlFor="file" className="text-gray-300">Unggah File Media (Audio/Video)</Label>
                <Input
                  id="file"
                  type="file"
                  accept="audio/*,video/*"
                  {...register("file")}
                  className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
                />
                {errors.file && <p className="text-red-400 text-sm mt-1">{errors.file.message as string}</p>}
                {editingMedia?.file_path && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-400 mb-1">File saat ini:</p>
                    {editingMedia.file_type === "audio" ? (
                      <audio controls src={supabase.storage.from('audio').getPublicUrl(editingMedia.file_path).data?.publicUrl} className="w-full max-w-xs" />
                    ) : (
                      <video controls src={supabase.storage.from('audio').getPublicUrl(editingMedia.file_path).data?.publicUrl} className="w-full max-w-xs h-32 object-contain" />
                    )}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="display_order" className="text-gray-300">Urutan Tampilan</Label>
                <Input
                  id="display_order"
                  type="number"
                  {...register("display_order")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {errors.display_order && <p className="text-red-400 text-sm mt-1">{errors.display_order.message}</p>}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="text-gray-300 border-gray-600 hover:bg-gray-700">
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? "Menyimpan..." : (editingMedia ? "Simpan Perubahan" : "Tambah Media")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default MediaPlayerSettings;