import React, { useState, useEffect, useRef, useCallback } from "react";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import { supabase } from "@/lib/supabase";
import * as Adhan from "adhan";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";

dayjs.extend(duration);
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);

interface PrayerTimeConfig {
  name: string; // Display name (e.g., "Subuh")
  adhanName: keyof Adhan.PrayerTimes; // Adhan.js prayer name (e.g., "fajr")
  audioUrlField: string; // Field name in app_settings for audio URL (e.g., "murottal_audio_url_fajr")
  activeField: string; // Field name in app_settings for active switch (e.g., "murottal_active_fajr")
  durationField: string; // Field name in app_settings for pre-adhan duration (e.g., "murottal_pre_adhan_duration_fajr")
  offsetField: string; // Field name in app_settings for prayer offset (e.g., "fajr_offset")
}

const PRAYER_CONFIGS: PrayerTimeConfig[] = [
  { name: "Subuh", adhanName: "fajr", audioUrlField: "murottal_audio_url_fajr", activeField: "murottal_active_fajr", durationField: "murottal_pre_adhan_duration_fajr", offsetField: "fajr_offset" },
  { name: "Dzuhur", adhanName: "dhuhr", audioUrlField: "murottal_audio_url_dhuhr", activeField: "murottal_active_dhuhr", durationField: "murottal_pre_adhan_duration_dhuhr", offsetField: "dhuhr_offset" },
  { name: "Ashar", adhanName: "asr", audioUrlField: "murottal_audio_url_asr", activeField: "murottal_active_asr", durationField: "murottal_pre_adhan_duration_asr", offsetField: "asr_offset" },
  { name: "Maghrib", adhanName: "maghrib", audioUrlField: "murottal_audio_url_maghrib", activeField: "murottal_active_maghrib", durationField: "murottal_pre_adhan_duration_maghrib", offsetField: "maghrib_offset" },
  { name: "Isya", adhanName: "isha", audioUrlField: "murottal_audio_url_isha", activeField: "murottal_active_isha", durationField: "murottal_pre_adhan_duration_isha", offsetField: "isha_offset" },
];

// Special config for Imsak, as it's not a standard Adhan prayer but has murottal settings
const IMSAK_CONFIG = {
  name: "Imsak",
  audioUrlField: "murottal_audio_url_imsak",
  activeField: "murottal_active_imsak",
  durationField: "murottal_pre_adhan_duration_imsak",
  offsetField: "imsak_offset", // Imsak offset is applied to Fajr time to get Imsak time
};

interface MurottalPlayerProps {
  onPlayingChange: (isPlaying: boolean) => void;
}

const MurottalPlayer: React.FC<MurottalPlayerProps> = ({ onPlayingChange }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<Adhan.PrayerTimes | null>(null);
  const [pausedMurottalInfo, setPausedMurottalInfo] = useState<{ url: string; currentTime: number } | null>(null);
  const [playbackPositions, setPlaybackPositions] = useState<Record<string, number>>({}); // New state for persistent playback positions
  
  const playedTodayRef = useRef<Set<string>>(new Set());
  const lastCheckedDayRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const playbackChannelRef = useRef<RealtimeChannel | null>(null); // New channel ref for playback states

  const savePlaybackPosition = useCallback(async (prayerAdhanName: string, position: number) => {
    console.log(`MurottalPlayer: Saving playback position for ${prayerAdhanName}: ${position}s`);
    const { error } = await supabase
      .from('murottal_playback_states')
      .upsert(
        { prayer_name: prayerAdhanName, last_played_position_seconds: position },
        { onConflict: 'prayer_name' }
      );
    if (error) {
      console.error("MurottalPlayer: Error saving playback position:", error);
    }
  }, []);

  const fetchSettingsAndPrayerTimes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("latitude, longitude, calculation_method, is_ramadan_mode_active, tarhim_active, tarhim_audio_url, tarhim_pre_adhan_duration, is_master_audio_active, adhan_beep_audio_url, iqomah_beep_audio_url, iqomah_countdown_duration, imsak_beep_audio_url, fajr_offset, dhuhr_offset, asr_offset, maghrib_offset, isha_offset, imsak_offset, adhan_duration_seconds, murottal_active_fajr, murottal_audio_url_fajr, murottal_pre_adhan_duration_fajr, murottal_active_dhuhr, murottal_audio_url_dhuhr, murottal_pre_adhan_duration_dhuhr, murottal_active_asr, murottal_audio_url_asr, murottal_pre_adhan_duration_asr, murottal_active_maghrib, murottal_audio_url_maghrib, murottal_pre_adhan_duration_maghrib, murottal_active_isha, murottal_audio_url_isha, murottal_pre_adhan_duration_isha, murottal_active_imsak, murottal_audio_url_imsak, murottal_pre_adhan_duration_imsak, maghrib_iqomah_countdown_duration") // Include all new fields
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("MurottalPlayer: Error fetching murottal settings:", error);
        toast.error("Gagal memuat pengaturan audio.");
        setSettings(null);
        setPrayerTimes(null);
        return;
      }

      if (data) {
        setSettings(data);
        console.log("MurottalPlayer: Fetched settings:", {
            isMasterAudioActive: data.is_master_audio_active,
            tarhimActive: data.tarhim_active,
            tarhimAudioUrlExists: !!data.tarhim_audio_url,
            isRamadanModeActive: data.is_ramadan_mode_active,
            adhanBeepAudioUrl: data.adhan_beep_audio_url,
            iqomahBeepAudioUrl: data.iqomah_beep_audio_url,
            imsakBeepAudioUrl: data.imsak_beep_audio_url,
            adhanDurationSeconds: data.adhan_duration_seconds,
            murottalActiveFajr: data.murottal_active_fajr,
            murottalPreAdhanDurationFajr: data.murottal_pre_adhan_duration_fajr,
            murottalActiveDhuhr: data.murottal_active_dhuhr,
            murottalPreAdhanDurationDhuhr: data.murottal_pre_adhan_duration_dhuhr,
            murottalActiveAsr: data.murottal_active_asr,
            murottalPreAdhanDurationAsr: data.murottal_pre_adhan_duration_asr,
            murottalActiveMaghrib: data.murottal_active_maghrib,
            murottalPreAdhanDurationMaghrib: data.murottal_pre_adhan_duration_maghrib,
            murottalActiveIsha: data.murottal_active_isha,
            murottalPreAdhanDurationIsha: data.murottal_pre_adhan_duration_isha,
            murottalActiveImsak: data.murottal_active_imsak,
            murottalPreAdhanDurationImsak: data.murottal_pre_adhan_duration_imsak,
            maghrib_iqomah_countdown_duration: data.maghrib_iqomah_countdown_duration,
        });

        // Check if any audio feature is active before calculating prayer times
        const anyAudioActive = data.is_master_audio_active || data.tarhim_active || data.adhan_beep_audio_url || data.iqomah_beep_audio_url || data.imsak_beep_audio_url || PRAYER_CONFIGS.some(config => data[config.activeField]) || (data.is_ramadan_mode_active && data[IMSAK_CONFIG.activeField]);

        if (anyAudioActive) {
          const coordinates = new Adhan.Coordinates(data.latitude || -6.2088, data.longitude || 106.8456);
          const params = Adhan.CalculationMethod[data.calculation_method as keyof typeof Adhan.CalculationMethod]();
          const today = new Date();
          
          const rawPrayerTimes = new Adhan.PrayerTimes(coordinates, today, params);

          const adjustedPrayerTimes = {
            fajr: dayjs(rawPrayerTimes.fajr).add(data.fajr_offset ?? 0, 'minute').toDate(),
            sunrise: dayjs(rawPrayerTimes.sunrise).toDate(),
            dhuhr: dayjs(rawPrayerTimes.dhuhr).add(data.dhuhr_offset ?? 0, 'minute').toDate(),
            asr: dayjs(rawPrayerTimes.asr).add(data.asr_offset ?? 0, 'minute').toDate(),
            maghrib: dayjs(rawPrayerTimes.maghrib).add(data.maghrib_offset ?? 0, 'minute').toDate(),
            isha: dayjs(rawPrayerTimes.isha).add(data.isha_offset ?? 0, 'minute').toDate(),
          };
          
          const finalPrayerTimes = {
            fajr: adjustedPrayerTimes.fajr,
            sunrise: adjustedPrayerTimes.sunrise,
            dhuhr: adjustedPrayerTimes.dhuhr,
            asr: adjustedPrayerTimes.asr,
            maghrib: adjustedPrayerTimes.maghrib,
            isha: adjustedPrayerTimes.isha,
            nextPrayer: () => "", // These are not used by MurottalPlayer directly
            currentPrayer: () => "", // These are not used by MurottalPlayer directly
            timeForPrayer: (prayer: Adhan.Prayer) => {
              switch (prayer) {
                case Adhan.Prayer.Fajr: return adjustedPrayerTimes.fajr;
                case Adhan.Prayer.Dhuhr: return adjustedPrayerTimes.dhuhr;
                case Adhan.Prayer.Asr: return adjustedPrayerTimes.asr;
                case Adhan.Prayer.Maghrib: return adjustedPrayerTimes.maghrib;
                case Adhan.Prayer.Isha: return adjustedPrayerTimes.isha;
                case Adhan.Prayer.Sunrise: return adjustedPrayerTimes.sunrise;
                default: return new Date();
              }
            }
          } as unknown as Adhan.PrayerTimes; // Cast to Adhan.PrayerTimes type

          setPrayerTimes(finalPrayerTimes);
          console.log("MurottalPlayer: Prayer times calculated and offsets applied.");
        } else {
          setPrayerTimes(null);
          console.log("MurottalPlayer: No audio features active. Skipping prayer time calculation.");
        }
      }

      // Fetch murottal playback positions
      const { data: playbackData, error: playbackError } = await supabase
        .from('murottal_playback_states')
        .select('prayer_name, last_played_position_seconds');

      if (playbackError) {
        console.error("MurottalPlayer: Error fetching playback positions:", playbackError);
      } else {
        const positions: Record<string, number> = {};
        playbackData?.forEach(item => {
          positions[item.prayer_name] = item.last_played_position_seconds;
        });
        setPlaybackPositions(positions);
        console.log("MurottalPlayer: Fetched playback positions:", positions);
      }

    } catch (err) {
      console.error("MurottalPlayer: Unexpected error fetching murottal settings:", err);
      toast.error("Terjadi kesalahan saat memuat pengaturan audio.");
      setSettings(null);
      setPrayerTimes(null);
    }
  }, [savePlaybackPosition]);

  useEffect(() => {
    fetchSettingsAndPrayerTimes();

    if (!channelRef.current) {
      channelRef.current = supabase
        .channel('murottal_settings_changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.1' }, (payload) => {
          console.log('MurottalPlayer: Murottal settings change received!', payload);
          fetchSettingsAndPrayerTimes();
        })
        .subscribe();
      console.log("MurottalPlayer: Subscribed to channel 'murottal_settings_changes'.");
    }

    // Subscribe to murottal_playback_states changes
    if (!playbackChannelRef.current) {
      playbackChannelRef.current = supabase
        .channel('murottal_playback_states_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'murottal_playback_states' }, (payload) => {
          console.log('MurottalPlayer: Playback state change received!', payload);
          // Re-fetch all playback positions to ensure consistency
          fetchSettingsAndPrayerTimes(); 
        })
        .subscribe();
      console.log("MurottalPlayer: Subscribed to channel 'murottal_playback_states_changes'.");
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        console.log("MurottalPlayer: Unsubscribed from channel 'murottal_settings_changes'.");
        channelRef.current = null;
      }
      if (playbackChannelRef.current) {
        supabase.removeChannel(playbackChannelRef.current);
        console.log("MurottalPlayer: Unsubscribed from channel 'murottal_playback_states_changes'.");
        playbackChannelRef.current = null;
      }
    };
  }, [fetchSettingsAndPrayerTimes]);

  const playAudio = async (url: string, eventName: string, isMurottal: boolean = false, prayerAdhanName: string | null = null) => {
    if (!audioRef.current || !url) {
      console.log(`MurottalPlayer: Cannot play ${eventName}. Audio ref not ready or URL is empty.`);
      return false;
    }

    // If a different audio is about to play, and the current audio is a murottal, save its position
    if (audioRef.current.src && audioRef.current.src !== url) {
      const currentMurottalConfig = PRAYER_CONFIGS.find(config => audioRef.current?.src.includes(settings[config.audioUrlField]?.split('/').pop() || '')) ||
                                   (settings.is_ramadan_mode_active && audioRef.current?.src.includes(settings[IMSAK_CONFIG.audioUrlField]?.split('/').pop() || '') ? IMSAK_CONFIG : null);
      if (currentMurottalConfig) {
        savePlaybackPosition(currentMurottalConfig.name, audioRef.current.currentTime);
        console.log(`MurottalPlayer: Saving current murottal (${currentMurottalConfig.name}) position ${audioRef.current.currentTime}s before playing new audio.`);
      }
    }

    // Existing logic for Imsak beep specific pause/resume
    const isCurrentAudioMurottal = PRAYER_CONFIGS.some(config => audioRef.current?.src.includes(settings[config.audioUrlField]?.split('/').pop() || '')) || 
                                   (settings.is_ramadan_mode_active && audioRef.current?.src.includes(settings[IMSAK_CONFIG.audioUrlField]?.split('/').pop() || '') ? IMSAK_CONFIG : null);

    if (isCurrentAudioMurottal && !isMurottal && !audioRef.current.paused) {
      // Find which murottal was playing to save its position
      const currentlyPlayingMurottalConfig = PRAYER_CONFIGS.find(config => audioRef.current?.src.includes(settings[config.audioUrlField]?.split('/').pop() || '')) ||
                                             (settings.is_ramadan_mode_active && audioRef.current?.src.includes(settings[IMSAK_CONFIG.audioUrlField]?.split('/').pop() || '') ? IMSAK_CONFIG : null);
      
      if (currentlyPlayingMurottalConfig) {
        savePlaybackPosition(currentlyPlayingMurottalConfig.name, audioRef.current.currentTime);
        setPausedMurottalInfo({
          url: audioRef.current.src,
          currentTime: audioRef.current.currentTime
        });
        console.log(`MurottalPlayer: Pausing current murottal for ${eventName} (${audioRef.current.src}) at ${audioRef.current.currentTime}s.`);
        audioRef.current.pause();
      }
    } else if (isMurottal && pausedMurottalInfo) {
      setPausedMurottalInfo(null);
    }

    audioRef.current.src = url;
    audioRef.current.load();

    if (isMurottal && prayerAdhanName && playbackPositions[prayerAdhanName] > 0) {
      audioRef.current.currentTime = playbackPositions[prayerAdhanName];
      console.log(`MurottalPlayer: Resuming ${eventName} from saved position: ${playbackPositions[prayerAdhanName]}s.`);
    } else {
      audioRef.current.currentTime = 0; // Start from beginning if no saved position or not murottal
    }

    try {
      await audioRef.current.play();
      playedTodayRef.current.add(eventName);
      onPlayingChange(true); // Report that audio is playing
      console.log(`MurottalPlayer: Audio for ${eventName} started playing.`);
      return true;
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.warn(`MurottalPlayer: Playback of ${eventName} aborted. This is expected if a higher priority audio takes over quickly.`);
      } else {
        console.error(`MurottalPlayer: Error playing audio for ${eventName}:`, e);
      }
      onPlayingChange(false); // Report that audio is not playing
      return false;
    }
  };

  useEffect(() => {
    if (!settings || !prayerTimes || !settings.is_master_audio_active) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      onPlayingChange(false); // Report that audio is not playing
      console.log("MurottalPlayer: Settings, prayerTimes, or master audio not available/active. Audio player inactive.");
      return;
    }

    const handleAudioEnded = () => {
      if (!audioRef.current) return;

      const endedAudioSrc = audioRef.current.src;
      console.log(`MurottalPlayer: Audio playback ended for ${endedAudioSrc}.`);

      // Check if the ended audio was an Imsak beep that paused a murottal
      if (settings.imsak_beep_audio_url && endedAudioSrc.includes(settings.imsak_beep_audio_url.split('/').pop() || '')) {
        console.log("MurottalPlayer: Imsak beep ended. Attempting to resume murottal if paused.");
        if (pausedMurottalInfo) {
          audioRef.current.src = pausedMurottalInfo.url;
          audioRef.current.currentTime = pausedMurottalInfo.currentTime;
          audioRef.current.play().then(() => {
            console.log(`MurottalPlayer: Resumed murottal from ${pausedMurottalInfo.currentTime}s.`);
            setPausedMurottalInfo(null);
            onPlayingChange(true);
          }).catch(e => {
            console.error("MurottalPlayer: Error resuming murottal:", e);
            onPlayingChange(false);
          });
          return; // Crucial: exit after handling Imsak beep resume
        }
      } 
      
      // If the ended audio was a Tarhim audio, clear any paused murottal info if any
      else if (settings.tarhim_audio_url && endedAudioSrc.includes(settings.tarhim_audio_url.split('/').pop() || '')) {
        console.log("MurottalPlayer: Tarhim audio ended. Murottal will NOT resume.");
        setPausedMurottalInfo(null); // Clear any paused murottal info
      } 
      
      // Check if the ended audio was a murottal and should loop
      const endedMurottalConfig = PRAYER_CONFIGS.find(config => endedAudioSrc.includes(settings[config.audioUrlField]?.split('/').pop() || '')) ||
                                 (settings.is_ramadan_mode_active && endedAudioSrc.includes(settings[IMSAK_CONFIG.audioUrlField]?.split('/').pop() || '') ? IMSAK_CONFIG : null);

      if (endedMurottalConfig) {
        // Murottal ended, loop it from the beginning
        audioRef.current.currentTime = 0;
        audioRef.current.play().then(() => {
          onPlayingChange(true);
          console.log(`MurottalPlayer: Murottal for ${endedMurottalConfig.name} looped from beginning.`);
        }).catch(e => {
          console.error(`MurottalPlayer: Error looping murottal for ${endedMurottalConfig.name}:`, e);
          audioRef.current?.pause();
          audioRef.current.src = "";
          onPlayingChange(false);
        });
        return; // Exit after handling murottal loop
      }

      // For non-murottal audio (or if looping failed), pause and clear source
      audioRef.current.pause();
      audioRef.current.src = "";
      onPlayingChange(false);
      console.log("MurottalPlayer: Non-murottal audio playback ended or murottal looping failed. Resetting audio source.");
    };

    const handleAudioPause = () => {
      if (!audioRef.current) return;
      const pausedAudioSrc = audioRef.current.src;
      const pausedMurottalConfig = PRAYER_CONFIGS.find(config => pausedAudioSrc.includes(settings[config.audioUrlField]?.split('/').pop() || '')) ||
                                   (settings.is_ramadan_mode_active && pausedAudioSrc.includes(settings[IMSAK_CONFIG.audioUrlField]?.split('/').pop() || '') ? IMSAK_CONFIG : null);
      if (pausedMurottalConfig) {
        savePlaybackPosition(pausedMurottalConfig.name, audioRef.current.currentTime);
        console.log(`MurottalPlayer: Murottal for ${pausedMurottalConfig.name} paused. Saved position: ${audioRef.current.currentTime}s.`);
      }
      onPlayingChange(false);
    };

    const handleAudioPlay = () => {
      onPlayingChange(true);
    };

    if (audioRef.current) {
      audioRef.current.addEventListener('ended', handleAudioEnded);
      audioRef.current.addEventListener('pause', handleAudioPause);
      audioRef.current.addEventListener('play', handleAudioPlay);
    }

    const checkAndPlayAudioLoop = async () => {
      const now = dayjs();
      const todayDate = now.format("YYYY-MM-DD");
      const isFriday = now.day() === 5; // Define isFriday here

      if (lastCheckedDayRef.current !== todayDate) {
        playedTodayRef.current = new Set();
        lastCheckedDayRef.current = todayDate;
        console.log(`MurottalPlayer: New day detected (${todayDate}). Resetting played audio list.`);
      }

      // Priority 1: Imsak Beep (if Ramadan mode active)
      console.log(`MurottalPlayer: Checking Imsak Beep. Ramadan Active: ${settings.is_ramadan_mode_active}, URL: ${!!settings.imsak_beep_audio_url}`);
      if (settings.is_ramadan_mode_active && settings.imsak_beep_audio_url) {
        const imsakTime = dayjs(prayerTimes.fajr).subtract(10, 'minute').add(settings.imsak_offset ?? 0, 'minute');
        const imsakEventName = "Imsak Beep";
        console.log(`MurottalPlayer: Imsak Time: ${imsakTime.format('HH:mm:ss')}, Current Time: ${now.format('HH:mm:ss')}, Played Today: ${playedTodayRef.current.has(imsakEventName)}`);
        
        if (now.isSameOrAfter(imsakTime) && !playedTodayRef.current.has(imsakEventName)) {
          console.log(`MurottalPlayer: *** Imsak Beep condition MET! Attempting to play. ***`);
          if (await playAudio(settings.imsak_beep_audio_url, imsakEventName)) {
            console.log(`MurottalPlayer: Imsak Beep successfully triggered.`);
            return;
          } else {
            console.log(`MurottalPlayer: Failed to play Imsak Beep.`);
          }
        }
      }

      // Priority 2: Tarhim
      console.log(`MurottalPlayer: Checking Tarhim. Tarhim Active: ${settings.tarhim_active}, URL: ${!!settings.tarhim_audio_url}`);
      if (settings.tarhim_active && settings.tarhim_audio_url) {
        const tarhimPreAdhanDurationMs = (settings.tarhim_pre_adhan_duration || 300) * 1000;
        const tarhimPrayers = [
          { name: "Tarhim Subuh", adhanTime: dayjs(prayerTimes.fajr) },
          { name: "Tarhim Isya", adhanTime: dayjs(prayerTimes.isha) },
        ];

        for (const tarhimConfig of tarhimPrayers) {
          const tarhimStartTime = tarhimConfig.adhanTime.subtract(tarhimPreAdhanDurationMs, 'millisecond');
          const tarhimEndTime = tarhimConfig.adhanTime; 
          console.log(`MurottalPlayer: Tarhim ${tarhimConfig.name} Start: ${tarhimStartTime.format('HH:mm:ss')}, End: ${tarhimEndTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);
          
          if (now.isBetween(tarhimStartTime, tarhimEndTime, null, '[)')) {
            console.log(`MurottalPlayer: Condition met for Tarhim ${tarhimConfig.name}. Attempting to play.`);
            if (await playAudio(settings.tarhim_audio_url, tarhimConfig.name)) {
              return;
            }
          }
        }
      }

      // Priority 3: Adhan Beep
      console.log(`MurottalPlayer: Checking Adhan Beep. URL: ${!!settings.adhan_beep_audio_url}`);
      if (settings.adhan_beep_audio_url) {
        const adhanPrayers = [
          { name: "Subuh", adhanTime: dayjs(prayerTimes.fajr) },
          { name: "Dzuhur", adhanTime: dayjs(prayerTimes.dhuhr) },
          { name: "Ashar", adhanTime: dayjs(prayerTimes.asr) },
          { name: "Maghrib", adhanTime: dayjs(prayerTimes.maghrib) },
          { name: "Isya", adhanTime: dayjs(prayerTimes.isha) },
        ];

        for (const adhanConfig of adhanPrayers) {
          const adhanTime = adhanConfig.adhanTime;
          const adhanBeepEventName = `${adhanConfig.name} Adhan Beep`;
          console.log(`MurottalPlayer: Adhan Beep ${adhanConfig.name} Time: ${adhanTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);
          // Play beep exactly at adhan time (within a 1-second window)
          if (now.isBetween(adhanTime.subtract(1, 'second'), adhanTime.add(1, 'second'), null, '[]') && !playedTodayRef.current.has(adhanBeepEventName)) {
            console.log(`MurottalPlayer: Condition met for Adhan Beep ${adhanConfig.name}. Attempting to play.`);
            if (await playAudio(settings.adhan_beep_audio_url, adhanBeepEventName)) {
              return;
            }
          }
        }
      }

      // Priority 4: Iqomah Beep
      console.log(`MurottalPlayer: Checking Iqomah Beep. URL: ${!!settings.iqomah_beep_audio_url}`);
      if (settings.iqomah_beep_audio_url) {
        const iqomahPrayers = [
          { name: "Subuh", adhanTime: dayjs(prayerTimes.fajr), iqomahDuration: settings.iqomah_countdown_duration },
          { name: "Dzuhur", adhanTime: dayjs(prayerTimes.dhuhr), iqomahDuration: settings.iqomah_countdown_duration },
          { name: "Ashar", adhanTime: dayjs(prayerTimes.asr), iqomahDuration: settings.iqomah_countdown_duration },
          { name: "Maghrib", adhanTime: dayjs(prayerTimes.maghrib), iqomahDuration: settings.maghrib_iqomah_countdown_duration },
          { name: "Isya", adhanTime: dayjs(prayerTimes.isha), iqomahDuration: settings.iqomah_countdown_duration },
        ];

        for (const iqomahConfig of iqomahPrayers) {
          const adhanEndTime = iqomahConfig.adhanTime.add(settings.adhan_duration_seconds, 'second');
          const iqomahTime = adhanEndTime; // Iqomah starts right after Adhan ends
          const iqomahBeepEventName = `${iqomahConfig.name} Iqomah Beep`;
          console.log(`MurottalPlayer: Iqomah Beep ${iqomahConfig.name} Time: ${iqomahTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);
          if (now.isBetween(iqomahTime.subtract(1, 'second'), iqomahTime.add(1, 'second'), null, '[]') && !playedTodayRef.current.has(iqomahBeepEventName)) {
            console.log(`MurottalPlayer: Condition met for Iqomah Beep ${iqomahConfig.name}. Attempting to play.`);
            if (await playAudio(settings.iqomah_beep_audio_url, iqomahBeepEventName)) {
              return;
            }
          }
        }
      }

      // Priority 5: Murottal per waktu sholat
      console.log("MurottalPlayer: Checking Murottal per prayer time.");
      for (const config of PRAYER_CONFIGS) {
        const isActive = settings[config.activeField];
        const audioUrl = settings[config.audioUrlField];
        const preAdhanDurationMinutes = settings[config.durationField] || 0;
        const prayerTime = dayjs(prayerTimes.timeForPrayer(Adhan.Prayer[config.adhanName.charAt(0).toUpperCase() + config.adhanName.slice(1) as keyof typeof Adhan.Prayer]));
        
        const murottalStartTime = prayerTime.subtract(preAdhanDurationMinutes, 'minute');
        const murottalEndTime = prayerTime; // Murottal stops at Adhan time
        const eventName = `${config.name} Murottal`;

        console.log(`MurottalPlayer: Murottal ${config.name} - Active: ${isActive}, URL: ${!!audioUrl}, Start: ${murottalStartTime.format('HH:mm:ss')}, End: ${murottalEndTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}, Played Today: ${playedTodayRef.current.has(eventName)}`);

        if (isActive && audioUrl && now.isBetween(murottalStartTime, murottalEndTime, null, '[)') && !playedTodayRef.current.has(eventName)) {
          console.log(`MurottalPlayer: Condition met for Murottal ${config.name}. Attempting to play.`);
          if (await playAudio(audioUrl, eventName, true, config.name)) {
            return;
          }
        }
      }

      // Priority 6: Imsak Murottal (if Ramadan mode active)
      console.log(`MurottalPlayer: Checking Imsak Murottal. Ramadan Active: ${settings.is_ramadan_mode_active}, Active: ${settings[IMSAK_CONFIG.activeField]}, URL: ${!!settings[IMSAK_CONFIG.audioUrlField]}`);
      if (settings.is_ramadan_mode_active && settings[IMSAK_CONFIG.activeField] && settings[IMSAK_CONFIG.audioUrlField]) {
        const imsakTime = dayjs(prayerTimes.fajr).subtract(10, 'minute').add(settings.imsak_offset ?? 0, 'minute');
        const preAdhanDurationMinutes = settings[IMSAK_CONFIG.durationField] || 0;
        const murottalStartTime = imsakTime.subtract(preAdhanDurationMinutes, 'minute');
        const murottalEndTime = imsakTime; // Imsak murottal stops at Imsak time
        const eventName = `${IMSAK_CONFIG.name} Murottal`;

        console.log(`MurottalPlayer: Murottal Imsak - Start: ${murottalStartTime.format('HH:mm:ss')}, End: ${murottalEndTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}, Played Today: ${playedTodayRef.current.has(eventName)}`);

        if (now.isBetween(murottalStartTime, murottalEndTime, null, '[)') && !playedTodayRef.current.has(eventName)) {
          console.log(`MurottalPlayer: Condition met for Murottal Imsak. Attempting to play.`);
          if (await playAudio(settings[IMSAK_CONFIG.audioUrlField], eventName, true, IMSAK_CONFIG.name)) {
            return;
          }
        }
      }

      // If no audio is supposed to be playing, ensure it's paused
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        console.log("MurottalPlayer: No audio condition met. Pausing current audio.");
      }
    };

    const interval = setInterval(checkAndPlayAudioLoop, 1000);
    checkAndPlayAudioLoop(); // Initial check

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnded);
        audioRef.current.removeEventListener('pause', handleAudioPause);
        audioRef.current.removeEventListener('play', handleAudioPlay);
      }
      clearInterval(interval);
      console.log("MurottalPlayer: Cleanup. Interval cleared, event listeners removed.");
    };
  }, [settings, prayerTimes, onPlayingChange, playAudio, savePlaybackPosition, pausedMurottalInfo, playbackPositions]);

  return (
    <audio ref={audioRef} className="hidden" />
  );
};

export default MurottalPlayer;