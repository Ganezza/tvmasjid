import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Trash2, Edit, PlusCircle, PlayCircle, CheckCircle, Upload, Youtube } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { RealtimeChannel } from "@supabase/supabase-js";

interface MediaFile {
  id: string;
  title: string | null;
  file_path: string;
  file_type: "audio" | "video";
  source_type: "upload" | "youtube";
}

const getYouTubeVideoId = (url: string): string | null => {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const uploadMediaFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(100, "Judul terlalu panjang.").nullable().optional(),
  file: z.instanceof(FileList).refine(file => file.length > 0, "File media harus diunggah.").optional(),
  file_type: z.enum(["audio", "video"], { message: "Tipe file tidak valid." }),
  display_order: z.coerce.number().int().min(0, "Urutan tampilan harus non-negatif.").default(0),
});

const youtubeMediaFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().max(100, "Judul terlalu panjang.").nullable().optional(),
  youtubeUrl: z.string().url("URL YouTube tidak valid.").min(1, "URL YouTube tidak boleh kosong.")
    .refine(url => getYouTubeVideoId(url) !== null, "URL YouTube tidak valid."),
  display_order: z.coerce.number().int().min(0, "Urutan tampilan harus non-negatif.").default(0),
});

type UploadMediaFormValues = z.infer<typeof uploadMediaFormSchema>;
type YoutubeMediaFormValues = z.infer<typeof youtubeMediaFormSchema>;

type DialogMode = 'none' | 'add-upload' | 'add-youtube' | 'edit-upload' | 'edit-youtube';

const MediaPlayerSettings: React.FC = () => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [dialogMode, setDialogMode] = useState<DialogMode>('none');
  const [editingMedia, setEditingMedia] = useState<MediaFile | null>(null);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const settingsChannelRef = useRef<RealtimeChannel | null>(null);

  const uploadForm = useForm<UploadMediaFormValues>({
    resolver: zodResolver(uploadMediaFormSchema),
    defaultValues: {
      title: "",
      file: undefined,
      file_type: "audio",
      display_order: 0,
    },
  });

  const youtubeForm = useForm<YoutubeMediaFormValues>({
    resolver: zodResolver(youtubeMediaFormSchema),
    defaultValues: {
      title: "",
      youtubeUrl: "",
      display_order: 0,
    },
  });

  const { handleSubmit: handleUploadSubmit, register: registerUpload, setValue: setUploadValue, reset: resetUploadForm, formState: { isSubmitting: isUploadSubmitting, errors: uploadErrors } } = uploadForm;
  const { handleSubmit: handleYoutubeSubmit, register: registerYoutube, setValue: setYoutubeValue, reset: resetYoutubeForm, watch: watchYoutubeUrl, formState: { isSubmitting: isYoutubeSubmitting, errors: youtubeErrors } } = youtubeForm;
  const currentYoutubeUrl = watchYoutubeUrl("youtubeUrl");

  const fetchMediaAndSettings = useCallback(async () => {
    try {
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

  const handleAddUploadMedia = () => {
    setEditingMedia(null);
    resetUploadForm();
    setDialogMode('add-upload');
  };

  const handleAddYoutubeMedia = () => {
    setEditingMedia(null);
    resetYoutubeForm();
    setDialogMode('add-youtube');
  };

  const handleEditMedia = (media: MediaFile) => {
    setEditingMedia(media);
    if (media.source_type === 'upload') {
      resetUploadForm({
        id: media.id,
        title: media.title || "",
        file_type: media.file_type,
        display_order: media.display_order,
        file: undefined,
      });
      setDialogMode('edit-upload');
    } else {
      resetYoutubeForm({
        id: media.id,
        title: media.title || "",
        youtubeUrl: media.file_path,
        display_order: media.display_order,
      });
      setDialogMode('edit-youtube');
    }
  };

  const handleDeleteMedia = async (media: MediaFile) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus media ini? Ini juga akan menghapus file dari penyimpanan jika diunggah.")) {
      return;
    }

    const deleteToastId = toast.loading("Menghapus media...");

    try {
      if (media.source_type === "upload") {
        const filePathInStorage = media.file_path; 
        
        const { data: removedFiles, error: storageError } = await supabase.storage
          .from('audio') // Ensure this is the correct bucket name
          .remove([filePathInStorage]);

        if (storageError) {
          console.error("Gagal menghapus file dari penyimpanan Supabase:", storageError);
          toast.error(`Gagal menghapus file dari penyimpanan: ${storageError.message}`, { id: deleteToastId });
        } else if (!removedFiles || removedFiles.length === 0) {
          console.warn("File tidak ditemukan di penyimpanan atau tidak ada file yang dihapus:", filePathInStorage);
          toast.warning("File tidak ditemukan di penyimpanan atau tidak ada file yang dihapus.", { id: deleteToastId });
        } else {
          console.log("File berhasil dihapus dari penyimpanan:", removedFiles);
        }
      }

      const { error: dbError } = await supabase
        .from("media_files")
        .delete()
        .eq("id", media.id);

      if (dbError) {
        throw dbError;
      }

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
      setActiveMediaId(mediaId);
    } catch (error: any) {
      console.error("Error setting active media:", error);
      toast.error(`Gagal mengatur media aktif: ${error.message}`, { id: setAsActiveToastId });
    }
  };

  const onSubmitUpload = async (values: UploadMediaFormValues) => {
    let filePath: string | null = null;
    let fileType: "audio" | "video" = values.file_type;
    const sourceType: "upload" = "upload";

    const oldFilePath = editingMedia?.source_type === 'upload' ? editingMedia.file_path : null;

    if (values.file && values.file.length > 0) {
      const file = values.file[0];
      const fileExtension = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      filePath = `media/${fileName}`;

      const uploadToastId = toast.loading("Mengunggah file media: 0%");

      try {
        const { data, error } = await supabase.storage
          .from('audio')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            onUploadProgress: (event: ProgressEvent) => {
              const percent = Math.round((event.loaded * 100) / event.total);
              console.log(`Upload progress for media player: ${percent}%`); // ADDED LOG
              toast.loading(`Mengunggah file media: ${percent}%`, { id: uploadToastId });
            },
          });

        if (error) {
          throw error;
        }
        toast.success("File media berhasil diunggah!", { id: uploadToastId });

        if (oldFilePath && oldFilePath !== filePath) {
          try {
            const { error: deleteOldFileError } = await supabase.storage
              .from('audio')
              .remove([oldFilePath]);
            if (deleteOldFileError) {
              console.warn("Gagal menghapus file media lama dari storage:", deleteOldFileError);
              toast.warning("Gagal menghapus file media lama.");
            } else {
              console.log("File media lama berhasil dihapus.");
            }
          } catch (e) {
            console.warn("Error parsing old file path for deletion:", e);
          }
        }

      } catch (error: any) {
        toast.error(`Gagal mengunggah file: ${error.message}`, { id: uploadToastId });
        return;
      }
    } else if (dialogMode === 'edit-upload' && editingMedia?.source_type === 'upload') {
      filePath = editingMedia.file_path;
      fileType = editingMedia.file_type;
    } else {
      toast.error("File media harus diunggah.");
      return;
    }

    if (!filePath) {
      toast.error("File media tidak valid.");
      return;
    }

    const payload = {
      title: values.title || null,
      file_path: filePath,
      file_type: fileType,
      source_type: sourceType,
      display_order: values.display_order,
    };

    if (dialogMode === 'edit-upload' && editingMedia) {
      const { error } = await supabase
        .from("media_files")
        .update(payload)
        .eq("id", editingMedia.id);

      if (error) {
        console.error("Error updating media in DB:", error);
        toast.error("Gagal memperbarui media.");
      } else {
        toast.success("Media berhasil diperbarui!");
        setDialogMode('none');
        fetchMediaAndSettings();
      }
    } else {
      const { error } = await supabase
        .from("media_files")
        .insert(payload);

      if (error) {
        console.error("Error adding media to DB:", error);
        toast.error("Gagal menambahkan media.");
      } else {
        toast.success("Media berhasil ditambahkan!");
        setDialogMode('none');
        fetchMediaAndSettings();
      }
    }
  };

  const onSubmitYoutube = async (values: YoutubeMediaFormValues) => {
    const videoId = getYouTubeVideoId(values.youtubeUrl);
    if (!videoId) {
      toast.error("URL YouTube tidak valid.");
      return;
    }
    const filePath = `https://www.youtube.com/embed/${videoId}`;
    const fileType: "video" = "video";
    const sourceType: "youtube" = "youtube";

    const payload = {
      title: values.title || null,
      file_path: filePath,
      file_type: fileType,
      source_type: sourceType,
      display_order: values.display_order,
    };

    if (dialogMode === 'edit-youtube' && editingMedia) {
      const { error } = await supabase
        .from("media_files")
        .update(payload)
        .eq("id", editingMedia.id);

      if (error) {
        console.error("Error updating media in DB:", error);
        toast.error("Gagal memperbarui media.");
      } else {
        toast.success("Media berhasil diperbarui!");
        setDialogMode('none');
        fetchMediaAndSettings();
      }
    } else {
      const { error } = await supabase
        .from("media_files")
        .insert(payload);

      if (error) {
        console.error("Error adding media to DB:", error);
        toast.error("Gagal menambahkan media.");
      } else {
        toast.success("Media berhasil ditambahkan!");
        setDialogMode('none');
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
        <p className="text-gray-400 mb-4">Kelola file audio/video atau tautan YouTube yang akan diputar di layar utama.</p>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white mb-4">
              <PlusCircle className="mr-2 h-4 w-4" /> Tambah Media Baru
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-gray-700 text-white border-gray-600">
            <DropdownMenuItem onClick={handleAddUploadMedia} className="cursor-pointer hover:bg-gray-600">
              <Upload className="mr-2 h-4 w-4" /> Unggah File Media
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddYoutubeMedia} className="cursor-pointer hover:bg-gray-600">
              <Youtube className="mr-2 h-4 w-4" /> Tambah Tautan YouTube
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="space-y-3">
          {mediaFiles.length === 0 ? (
            <p className="text-gray-400 text-center">Belum ada file media. Tambahkan yang pertama!</p>
          ) : (
            mediaFiles.map((media) => (
              <div key={media.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-md shadow-sm">
                <div className="flex-grow mr-2">
                  <p className="font-medium text-lg text-blue-200">{media.title || "(Tanpa Judul)"}</p>
                  <p className="text-sm text-gray-300">
                    Tipe: {media.file_type} | Sumber: {media.source_type} | Urutan: {media.display_order}
                  </p>
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

        {/* Dialog for Upload Media */}
        <Dialog open={dialogMode === 'add-upload' || dialogMode === 'edit-upload'} onOpenChange={(open) => { if (!open) setDialogMode('none'); }}>
          <DialogContent className="bg-gray-800 text-white border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-blue-300">{dialogMode === 'edit-upload' ? "Edit Media Unggahan" : "Unggah File Media Baru"}</DialogTitle>
              <DialogDescription>
                {dialogMode === 'edit-upload' ? "Perbarui detail media unggahan ini." : "Unggah file audio atau video baru untuk diputar di layar utama."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUploadSubmit(onSubmitUpload)} className="space-y-4">
              <div>
                <Label htmlFor="uploadTitle" className="text-gray-300">Judul (Opsional)</Label>
                <Input
                  id="uploadTitle"
                  {...registerUpload("title")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Judul media (mis: Rekaman Kajian)"
                />
                {uploadErrors.title && <p className="text-red-400 text-sm mt-1">{uploadErrors.title.message}</p>}
              </div>

              <div>
                <Label htmlFor="file" className="text-gray-300">Unggah File Media (Audio/Video)</Label>
                <Input
                  id="file"
                  type="file"
                  accept="audio/*,video/*"
                  {...registerUpload("file")}
                  className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
                />
                {uploadErrors.file && <p className="text-red-400 text-sm mt-1">{uploadErrors.file.message as string}</p>}
                {dialogMode === 'edit-upload' && editingMedia?.source_type === "upload" && editingMedia.file_path && (
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
                <Label htmlFor="file_type" className="text-gray-300">Tipe File</Label>
                <Select
                  onValueChange={(value: "audio" | "video") => setUploadValue("file_type", value)}
                  defaultValue={uploadForm.getValues("file_type")}
                >
                  <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white mt-1">
                    <SelectValue placeholder="Pilih Tipe File" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white border-gray-600">
                    <SelectItem value="audio">Audio</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
                {uploadErrors.file_type && <p className="text-red-400 text-sm mt-1">{uploadErrors.file_type.message}</p>}
              </div>

              <div>
                <Label htmlFor="uploadDisplayOrder" className="text-gray-300">Urutan Tampilan</Label>
                <Input
                  id="uploadDisplayOrder"
                  type="number"
                  {...registerUpload("display_order")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {uploadErrors.display_order && <p className="text-red-400 text-sm mt-1">{uploadErrors.display_order.message}</p>}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode('none')} className="text-gray-300 border-gray-600 hover:bg-gray-700">
                  Batal
                </Button>
                <Button type="submit" disabled={isUploadSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isUploadSubmitting ? "Menyimpan..." : (dialogMode === 'edit-upload' ? "Simpan Perubahan" : "Unggah Media")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog for YouTube Media */}
        <Dialog open={dialogMode === 'add-youtube' || dialogMode === 'edit-youtube'} onOpenChange={(open) => { if (!open) setDialogMode('none'); }}>
          <DialogContent className="bg-gray-800 text-white border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-blue-300">{dialogMode === 'edit-youtube' ? "Edit Tautan YouTube" : "Tambah Tautan YouTube Baru"}</DialogTitle>
              <DialogDescription>
                {dialogMode === 'edit-youtube' ? "Perbarui detail tautan YouTube ini." : "Tambahkan tautan video YouTube baru untuk diputar di layar utama."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleYoutubeSubmit(onSubmitYoutube)} className="space-y-4">
              <div>
                <Label htmlFor="youtubeTitle" className="text-gray-300">Judul (Opsional)</Label>
                <Input
                  id="youtubeTitle"
                  {...registerYoutube("title")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Judul video (mis: Khutbah Jumat Terbaru)"
                />
                {youtubeErrors.title && <p className="text-red-400 text-sm mt-1">{youtubeErrors.title.message}</p>}
              </div>

              <div>
                <Label htmlFor="youtubeUrl" className="text-gray-300">URL Video YouTube</Label>
                <Input
                  id="youtubeUrl"
                  type="url"
                  {...registerYoutube("youtubeUrl")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                  placeholder="Contoh: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                />
                {youtubeErrors.youtubeUrl && <p className="text-red-400 text-sm mt-1">{youtubeErrors.youtubeUrl.message}</p>}
                {currentYoutubeUrl && getYouTubeVideoId(currentYoutubeUrl) && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-400 mb-1">Pratinjau Video:</p>
                    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                      <iframe
                        className="absolute top-0 left-0 w-full h-full rounded-md border border-gray-600"
                        src={`https://www.youtube.com/embed/${getYouTubeVideoId(currentYoutubeUrl)}?autoplay=0&controls=1&modestbranding=1&rel=0`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      ></iframe>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="youtubeDisplayOrder" className="text-gray-300">Urutan Tampilan</Label>
                <Input
                  id="youtubeDisplayOrder"
                  type="number"
                  {...registerYoutube("display_order")}
                  className="bg-gray-700 border-gray-600 text-white mt-1"
                />
                {youtubeErrors.display_order && <p className="text-red-400 text-sm mt-1">{youtubeErrors.display_order.message}</p>}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode('none')} className="text-gray-300 border-gray-600 hover:bg-gray-700">
                  Batal
                </Button>
                <Button type="submit" disabled={isYoutubeSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isYoutubeSubmitting ? "Menyimpan..." : (dialogMode === 'edit-youtube' ? "Simpan Perubahan" : "Tambah Tautan")}
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