const AudioSettings: React.FC = () => {
  const { settings, isLoadingSettings, refetchSettings } = useAppSettings();
  const [availableAudioFiles, setAvailableAudioFiles] = useState<MediaFile[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const form = useForm<AudioSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      murottalActive: false,
      tarhimActive: false,
      iqomahCountdownDuration: 300,
      murottalPreAdhanDuration: 10,
      tarhimPreAdhanDuration: 300,
      murottalAudioUrlFajr: null,
      murottalAudioUrlDhuhr: null,
      murottalAudioUrlAsr: null,
      murottalAudioUrlMaghrib: null,
      murottalAudioUrlIsha: null,
      murottalAudioUrlImsak: null,
      tarhimAudioUrl: null,
      khutbahDurationMinutes: 45,
      isMasterAudioActive: true,
      adhanBeepAudioUrl: null,
      iqomahBeepAudioUrl: null,
      imsakBeepAudioUrl: null,
    },
  });

  const uploadForm = useForm<UploadAudioFormValues>({
    resolver: zodResolver(uploadAudioFormSchema),
    defaultValues: {
      title: "",
      file: undefined,
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;
  const { handleSubmit: handleUploadSubmit, register: registerUpload, reset: resetUploadForm, formState: { isSubmitting: isUploading, errors: uploadErrors } } = uploadForm;

  const fetchAvailableAudioFiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("media_files")
        .select("id, title, file_path, file_type, source_type")
        .eq("file_type", "audio")
        .eq("source_type", "upload")
        .order("title", { ascending: true });

      if (error) {
        console.error("Error fetching available audio files:", error);
        toast.error("Gagal memuat daftar audio.");
      } else {
        setAvailableAudioFiles(data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching available audio files:", err);
      toast.error("Terjadi kesalahan saat memuat daftar audio.");
    }
  }, []);

  useEffect(() => {
    fetchAvailableAudioFiles(); // Initial fetch of available audio files

    if (!isLoadingSettings && settings) {
      setValue("murottalActive", settings.murottal_active);
      setValue("tarhimActive", settings.tarhim_active);
      setValue("iqomahCountdownDuration", settings.iqomah_countdown_duration);
      setValue("murottalPreAdhanDuration", settings.murottal_pre_adhan_duration || 10);
      setValue("tarhimPreAdhanDuration", settings.tarhim_pre_adhan_duration || 300);
      setValue("murottalAudioUrlFajr", settings.murottal_audio_url_fajr);
      setValue("murottalAudioUrlDhuhr", settings.murottal_audio_url_dhuhr);
      setValue("murottalAudioUrlAsr", settings.murottal_audio_url_asr);
      setValue("murottalAudioUrlMaghrib", settings.murottal_audio_url_maghrib);
      setValue("murottalAudioUrlIsha", settings.murottal_audio_url_isha);
      setValue("murottalAudioUrlImsak", settings.murottal_audio_url_imsak);
      setValue("tarhimAudioUrl", settings.tarhim_audio_url);
      setValue("khutbahDurationMinutes", settings.khutbah_duration_minutes || 45);
      setValue("isMasterAudioActive", settings.is_master_audio_active ?? true);
      setValue("adhanBeepAudioUrl", settings.adhan_beep_audio_url);
      setValue("iqomahBeepAudioUrl", settings.iqomah_beep_audio_url);
      setValue("imsakBeepAudioUrl", settings.imsak_beep_audio_url);
    }
  }, [settings, isLoadingSettings, setValue, fetchAvailableAudioFiles]);

  const handleUploadNewAudio = async (values: UploadAudioFormValues) => {
    const file = values.file[0];
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `audio/${fileName}`;

    const uploadToastId = toast.loading(`Mengunggah audio: 0%`);

    try {
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          onUploadProgress: (event: ProgressEvent) => {
            const percent = Math.round((event.loaded * 100) / event.total);
            toast.loading(`Mengunggah audio: ${percent}%`, { id: uploadToastId });
          },
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('audio')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        // Insert into media_files table
        const { error: insertError } = await supabase
          .from('media_files')
          .insert({
            title: values.title || file.name,
            file_path: filePath, // Store the internal path
            file_type: 'audio',
            source_type: 'upload',
            display_order: 0, // Default, can be changed later in MediaPlayerSettings
          });

        if (insertError) {
          // If DB insert fails, try to remove the uploaded file from storage
          await supabase.storage.from('audio').remove([filePath]);
          throw insertError;
        }

        toast.loading("Mengunggah audio: 100%", { id: uploadToastId });
        toast.success("Audio berhasil diunggah dan ditambahkan ke daftar!", { id: uploadToastId });
        toast.info("Untuk performa terbaik di perangkat rendah, pastikan ukuran file audio dioptimalkan (misal: format MP3, bitrate rendah).");
        
        setIsUploadDialogOpen(false);
        resetUploadForm();
        fetchAvailableAudioFiles(); // Refresh the list of available audio files
      } else {
        throw new Error("Gagal mendapatkan URL publik audio.");
      }
    } catch (error: any) {
      console.error("Error uploading audio:", error);
      toast.error(`Gagal mengunggah audio: ${error.message}`, { id: uploadToastId });
    }
  };