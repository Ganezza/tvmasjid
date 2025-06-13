console.log(`MurottalPlayer: Iqomah Beep ${iqomahConfig.name} End Time: ${iqomahEndTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);
          
          if (now.isBetween(iqomahEndTime.subtract(1, 'second'), iqomahEndTime.add(1, 'second'), null, '[]')) {
            console.log(`MurottalPlayer: Condition met for Iqomah Beep ${iqomahConfig.name} (at end of countdown). Attempting to play.`);
            if (await playAudio(settings.iqomah_beep_audio_url, iqomahBeepEventName)) {
              return;
            }
          }
        }
      }

      // Priority 5: Murottal per waktu sholat (termasuk Imsak jika mode Ramadan aktif)
      console.log(`MurottalPlayer: Checking Murottal per prayer. Paused Murottal Info: ${!!pausedMurottalInfo}`);
      if (!pausedMurottalInfo) { // Only play murottal if no other audio is paused
        // Check for Imsak Murottal first if Ramadan mode is active
        if (settings.is_ramadan_mode_active && settings[IMSAK_CONFIG.activeField] && settings[IMSAK_CONFIG.audioUrlField]) {
          const imsakTime = dayjs(prayerTimes.fajr).subtract(10, 'minute').add(settings.imsak_offset ?? 0, 'minute');
          const imsakPreAdhanDurationMs = (settings[IMSAK_CONFIG.durationField] || 10) * 60 * 1000; // Default 10 minutes
          
          const imsakMurottalStartTime = imsakTime.subtract(imsakPreAdhanDurationMs, 'millisecond');
          const imsakMurottalEndTime = imsakTime; // Murottal stops at Imsak time

          console.log(`MurottalPlayer: Murottal Imsak - Start: ${imsakMurottalStartTime.format('HH:mm:ss')}, End: ${imsakMurottalEndTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);

          if (now.isBetween(imsakMurottalStartTime, imsakMurottalEndTime, null, '[)')) {
            console.log(`MurottalPlayer: Condition met for Murottal Imsak. Attempting to play.`);
            if (await playAudio(settings[IMSAK_CONFIG.audioUrlField], `Murottal ${IMSAK_CONFIG.name}`, true, IMSAK_CONFIG.name)) {
              return;
            }
          }
        }

        // Check for regular prayer murottals
        for (const config of PRAYER_CONFIGS) {
          if (!settings[config.activeField] || !settings[config.audioUrlField]) {
            continue; // Skip if murottal for this prayer is not active or no audio URL
          }

          const adhanTime = prayerTimes[config.adhanName];
          if (!adhanTime) continue;
          const prayerTime = dayjs(adhanTime);
          const audioUrl = settings[config.audioUrlField];
          const preAdhanDurationMinutes = settings[config.durationField] || 10; // Default 10 minutes
          const preAdhanDurationMs = preAdhanDurationMinutes * 60 * 1000;
          
          const murottalStartTime = prayerTime.subtract(preAdhanDurationMs, 'millisecond');
          const murottalEndTime = prayerTime; // Murottal stops at Adhan time

          console.log(`MurottalPlayer: Murottal ${config.name} - Start: ${murottalStartTime.format('HH:mm:ss')}, End: ${murottalEndTime.format('HH:mm:ss')}, Current: ${now.format('HH:mm:ss')}`);

          if (now.isBetween(murottalStartTime, murottalEndTime, null, '[)')) {
            console.log(`MurottalPlayer: Condition met for Murottal ${config.name}. Attempting to play.`);
            if (await playAudio(audioUrl, `Murottal ${config.name}`, true, config.name)) {
              return;
            }
          }
        }
      }

      // If no audio condition is met and something is currently playing, pause it and save its state
      if (audioRef.current && !audioRef.current.paused) {
        const currentAudioSrc = audioRef.current.src;
        const currentMurottalConfig = PRAYER_CONFIGS.find(config => currentAudioSrc.includes(settings[config.audioUrlField]?.split('/').pop() || '')) ||
                                     (settings.is_ramadan_mode_active && currentAudioSrc.includes(settings[IMSAK_CONFIG.audioUrlField]?.split('/').pop() || '') ? IMSAK_CONFIG : null);
        
        if (currentMurottalConfig) {
          savePlaybackPosition(currentMurottalConfig.name, audioRef.current.currentTime);
          console.log(`MurottalPlayer: Paused and saved murottal for ${currentMurottalConfig.name} because no active audio condition met.`);
        } else {
          console.log("MurottalPlayer: Paused non-murottal audio because no active audio condition met.");
        }
        audioRef.current.pause();
        audioRef.current.src = "";
        onPlayingChange(false); // Report that audio is not playing
      }
    };

    const interval = setInterval(checkAndPlayAudioLoop, 1000);

    return () => {
      clearInterval(interval);
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleAudioEnded);
        audioRef.current.removeEventListener('pause', handleAudioPause);
        audioRef.current.removeEventListener('play', handleAudioPlay);
        // Save position on unmount if murottal was playing
        const currentMurottalConfig = PRAYER_CONFIGS.find(config => audioRef.current?.src.includes(settings[config.audioUrlField]?.split('/').pop() || '')) ||
                                     (settings.is_ramadan_mode_active && audioRef.current?.src.includes(settings[IMSAK_CONFIG.audioUrlField]?.split('/').pop() || '') ? IMSAK_CONFIG : null);
        if (currentMurottalConfig && !audioRef.current.paused) {
          savePlaybackPosition(currentMurottalConfig.name, audioRef.current.currentTime);
          console.log(`MurottalPlayer: Saving murottal for ${currentMurottalConfig.name} on unmount.`);
        }
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      onPlayingChange(false); // Report that audio is not playing on unmount
      console.log("MurottalPlayer: Cleanup. Audio player stopped.");
    };
  }, [settings, prayerTimes, pausedMurottalInfo, onPlayingChange, savePlaybackPosition, playbackPositions, isFriday]); // Added isFriday to dependencies

  return (
    <audio ref={audioRef} />
  );
};

export default MurottalPlayer;