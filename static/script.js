document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchBarContainer = document.getElementById('search-bar-container');
    const loading = document.getElementById('loading');
    const pageTitle = document.getElementById('page-title');
    
    // Views
    const homeView = document.getElementById('home-view');
    const listView = document.getElementById('list-view');
    const playerView = document.getElementById('player-view');
    const emptyState = document.getElementById('empty-state');
    
    // Containers
    const tracksList = document.getElementById('tracks-list');
    const queueList = document.getElementById('queue-list');
    const navPlayer = document.getElementById('nav-player');
    
    // Playback UI
    const nativeAudio = document.getElementById('native-audio');
    const playBtn = document.getElementById('main-play-btn');
    const playBtnIcon = playBtn.querySelector('i');
    const nextBtn = document.querySelector('.next-btn');
    const prevBtn = document.querySelector('.prev-btn');
    const npTitle = document.querySelector('.np-title');
    const npArtist = document.querySelector('.np-artist');
    const npArtwork = document.querySelector('.np-artwork');
    const artworkWrapper = document.querySelector('.artwork-wrapper');
    const progressBar = document.getElementById('progress-bar');
    const progressBarContainer = document.getElementById('progress-bar-container');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    
    // Big Player UI
    const npBigArt = document.getElementById('np-big-art');
    const npBigTitle = document.getElementById('np-big-title');
    const npBigArtist = document.getElementById('np-big-artist');
    
    // Volume
    const volumeBarContainer = document.getElementById('volume-bar-container');
    const volumeBar = document.getElementById('volume-bar');
    const volumeIcon = document.querySelector('.volume-icon');
    
    // Mobile Expand Player
    const floatingPlayer = document.querySelector('.floating-player');
    const collapsePlayerBtn = document.getElementById('collapse-player');

    floatingPlayer.addEventListener('click', (e) => {
        if (window.innerWidth <= 800 && !floatingPlayer.classList.contains('expanded')) {
            if (e.target.closest('button') || e.target.closest('.like-btn')) return;
            floatingPlayer.classList.add('expanded');
        }
    });

    collapsePlayerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        floatingPlayer.classList.remove('expanded');
    });
    
    // Download Button
    const downloadBtn = document.getElementById('np-download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentTrackId && urlCache[currentTrackId]) {
                const track = queue.find(t => t.id === currentTrackId);
                if (track) {
                    const icon = downloadBtn.querySelector('i');
                    icon.className = 'ph ph-spinner spin-icon';
                    
                    const url = urlCache[currentTrackId];
                    const songName = `${track.name} - ${track.artists}`;
                    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(songName)}`;
                    
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = songName + '.mp3';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    setTimeout(() => {
                        icon.className = 'ph ph-download-simple';
                    }, 2000);
                }
            } else {
                alert('Please wait for the song to start playing before downloading.');
            }
        });
    }

    // Refresh Recommendations Button
    const refreshBtn = document.getElementById('refresh-recommendations-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            if (queue.length > 0 && currentTrackIndex >= 0) {
                const icon = refreshBtn.querySelector('i');
                icon.classList.add('spin-icon');
                fetchRelatedTracksAndAppend(queue[currentTrackIndex]).then(() => {
                    icon.classList.remove('spin-icon');
                });
            }
        });
    }
    
    // State
    let debounceTimeout;
    let likedSongs = JSON.parse(localStorage.getItem('likedSongs')) || [];
    let recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || ['Global Hits'];
    let currentView = 'home';
    let currentContextList = [];
    
    // Queue State
    let queue = [];
    let currentTrackIndex = -1;
    let isPlaying = false;
    let currentTrackId = null;
    let urlCache = {};

    // Init
    switchView('home');
    nativeAudio.volume = 1;
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            switchView(item.dataset.view);
        });
    });

    function switchView(view) {
        currentView = view;
        homeView.classList.add('hidden');
        listView.classList.add('hidden');
        playerView.classList.add('hidden');
        emptyState.classList.add('hidden');
        loading.classList.add('hidden');
        
        if (view === 'home') {
            searchBarContainer.classList.add('hidden');
            homeView.classList.remove('hidden');
            pageTitle.textContent = 'Discover';
            loadHomeData();
        } else if (view === 'search') {
            searchBarContainer.classList.remove('hidden');
            pageTitle.textContent = 'Search';
            searchInput.focus();
            if (searchInput.value.trim()) {
                performSearch(searchInput.value.trim());
            } else {
                emptyState.classList.remove('hidden');
            }
        } else if (view === 'liked') {
            searchBarContainer.classList.add('hidden');
            pageTitle.textContent = 'Favorites';
            currentContextList = likedSongs;
            if (likedSongs.length > 0) {
                renderList(likedSongs);
            } else {
                emptyState.querySelector('h3').textContent = 'No Favorites yet';
                emptyState.querySelector('p').textContent = 'Heart your favorite songs to see them here.';
                emptyState.classList.remove('hidden');
            }
        } else if (view === 'player') {
            searchBarContainer.classList.add('hidden');
            pageTitle.textContent = 'Now Playing';
            playerView.classList.remove('hidden');
            renderPlayerViewQueue();
        }
    }

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        const query = e.target.value.trim();

        if (!query) {
            emptyState.classList.remove('hidden');
            listView.classList.add('hidden');
            loading.classList.add('hidden');
            emptyState.querySelector('h3').textContent = 'Let the music play';
            emptyState.querySelector('p').textContent = 'Search for a track to begin your journey.';
            return;
        }

        debounceTimeout = setTimeout(() => {
            performSearch(query);
            if(!recentSearches.includes(query)) {
                recentSearches.unshift(query);
                if(recentSearches.length > 5) recentSearches.pop();
                localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
            }
        }, 500); 
    });

    async function performSearch(query) {
        emptyState.classList.add('hidden');
        listView.classList.add('hidden');
        loading.classList.remove('hidden');

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                currentContextList = data.results;
                renderList(data.results);
            } else {
                showEmptyState('No results found', 'Try different keywords.');
            }
        } catch (error) {
            showEmptyState('Error', 'Could not fetch results. Try again later.');
        }
    }

    function showEmptyState(title, desc) {
        emptyState.querySelector('h3').textContent = title;
        emptyState.querySelector('p').textContent = desc;
        emptyState.classList.remove('hidden');
        loading.classList.add('hidden');
    }

    function renderList(tracks) {
        tracksList.innerHTML = '';
        
        tracks.forEach((track, index) => {
            const row = document.createElement('div');
            row.className = 'track-row';
            if(currentTrackId === track.id) row.classList.add('playing');
            row.setAttribute('data-track-id', track.id);
            
            const isLiked = likedSongs.some(t => t.id === track.id);
            const heartClass = isLiked ? 'ph-fill ph-heart liked' : 'ph ph-heart';
            
            row.innerHTML = `
                <div class="track-left playable">
                    <span class="track-num">${index + 1}</span>
                    <img src="${track.cover_art || 'https://via.placeholder.com/44'}" class="track-img" alt="cover">
                    <div class="track-info">
                        <span class="track-title">${track.name} <div class="mini-eq"><div class="mini-bar"></div><div class="mini-bar"></div><div class="mini-bar"></div></div></span>
                        <span class="track-artist">${track.artists}</span>
                    </div>
                </div>
                <div class="track-album playable">${track.album}</div>
                <div class="track-right">
                    <span class="track-duration">${track.duration}</span>
                    <i class="${heartClass} action-icon like-btn" data-id="${track.id}"></i>
                </div>
            `;
            
            row.querySelectorAll('.playable').forEach(el => {
                el.addEventListener('click', () => {
                    queue = [...tracks];
                    playTrack(index);
                });
            });
            
            row.querySelector('.like-btn').addEventListener('click', (e) => {
                toggleLike(track, e.target);
            });
            
            tracksList.appendChild(row);
        });

        loading.classList.add('hidden');
        listView.classList.remove('hidden');
    }

    function toggleLike(track, iconEl) {
        const index = likedSongs.findIndex(t => t.id === track.id);
        if (index > -1) {
            likedSongs.splice(index, 1);
            if(iconEl) iconEl.className = 'ph ph-heart action-icon like-btn';
        } else {
            likedSongs.push(track);
            if(iconEl) iconEl.className = 'ph-fill ph-heart action-icon like-btn liked';
        }
        localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
        
        // Update main player like button if it's the current track
        if (currentTrackId === track.id) {
            updateMainLikeBtn(track);
        }
        
        if (currentView === 'liked') {
            currentContextList = likedSongs;
            if (likedSongs.length > 0) renderList(likedSongs);
            else switchView('liked');
        }
        if (currentView === 'player') {
            renderPlayerViewQueue();
        }
    }
    
    function updateMainLikeBtn(track) {
        const mainLikeBtn = document.getElementById('np-like-btn');
        const isLiked = likedSongs.some(t => t.id === track.id);
        if (isLiked) {
            mainLikeBtn.innerHTML = '<i class="ph-fill ph-heart"></i>';
            mainLikeBtn.classList.add('liked');
        } else {
            mainLikeBtn.innerHTML = '<i class="ph ph-heart"></i>';
            mainLikeBtn.classList.remove('liked');
        }
        
        mainLikeBtn.onclick = () => {
            toggleLike(track, null);
            updateMainLikeBtn(track);
            // Re-render list if visible to update icons
            if (currentView === 'liked' || currentView === 'search') {
                document.querySelectorAll('.track-row').forEach(row => {
                    if (row.getAttribute('data-track-id') === track.id) {
                        const icon = row.querySelector('.like-btn');
                        if (isLiked) icon.className = 'ph ph-heart action-icon like-btn';
                        else icon.className = 'ph-fill ph-heart action-icon like-btn liked';
                    }
                });
            }
        };
    }

    async function preloadNext(index) {
        if (index >= queue.length) return;
        const track = queue[index];
        if (urlCache[track.id]) return; 
        
        try {
            const primaryArtist = track.artists.split(',')[0].trim();
            const query = `${track.name} ${primaryArtist}`;
            const response = await fetch(`/api/play?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if(data.url) {
                urlCache[track.id] = data.url;
            }
        } catch(err) {
            console.error("Preload failed", err);
        }
    }

    let isFetchingRelated = false;
    async function fetchRelatedTracksAndAppend(track) {
        if (isFetchingRelated) return;
        isFetchingRelated = true;
        try {
            const primaryArtist = track.artists.split(',')[0].trim();
            const mixWords = ["hits", "popular", "latest", "audio", "music", "top"];
            const randomWord = mixWords[Math.floor(Math.random() * mixWords.length)];
            const query = `${primaryArtist} ${randomWord}`;
            
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.results) {
                const historyAndCurrent = queue.slice(0, currentTrackIndex + 1);
                const newTracks = data.results.filter(newTrack => !historyAndCurrent.some(qTrack => qTrack.id === newTrack.id));
                if (newTracks.length > 0) {
                    const toAppend = newTracks.slice(0, 15);
                    // Replace upcoming tracks instead of just making the list longer
                    queue = historyAndCurrent.concat(toAppend);
                    
                    if (currentView === 'player') {
                        renderPlayerViewQueue();
                    }
                }
            }
        } catch (err) {}
        isFetchingRelated = false;
    }

    function renderPlayerViewQueue() {
        queueList.innerHTML = '';
        if (queue.length === 0 || currentTrackIndex < 0) return;
        // Slice from currentTrackIndex to put the playing song at the top, without a 15-track limit
        const upcoming = queue.slice(currentTrackIndex);
        if (upcoming.length === 0) return;
        
        upcoming.forEach((t, i) => {
            const actualIndex = currentTrackIndex + i; // i=0 is currentTrackIndex
            const row = document.createElement('div');
            row.className = 'track-row playable';
            row.setAttribute('data-track-id', t.id); // Set ID so the animation logic can find it!
            
            if (actualIndex === currentTrackIndex) {
                row.classList.add('playing');
            }
            const heartClass = likedSongs.some(lk => lk.id === t.id) ? 'ph-fill ph-heart liked' : 'ph ph-heart';
            
            row.innerHTML = `
                <div class="track-left playable">
                    <img src="${t.cover_art || 'https://via.placeholder.com/44'}" class="track-img" alt="cover">
                    <div class="track-info">
                        <span class="track-title">${t.name} <div class="mini-eq"><div class="mini-bar"></div><div class="mini-bar"></div><div class="mini-bar"></div></div></span>
                        <span class="track-artist">${t.artists}</span>
                    </div>
                </div>
                <div class="track-right">
                    <span class="track-duration">${t.duration}</span>
                    <i class="${heartClass} action-icon like-btn" data-id="${t.id}"></i>
                </div>
            `;
            
            row.querySelectorAll('.playable').forEach(el => {
                el.addEventListener('click', () => {
                    playTrack(actualIndex);
                });
            });
            row.querySelector('.like-btn').addEventListener('click', (e) => toggleLike(t, e.target));
            queueList.appendChild(row);
        });
        
        // Auto scroll to current playing track so they don't have to scroll down manually
        setTimeout(() => {
            const playingRow = queueList.querySelector('.track-row.playing');
            if (playingRow) {
                playingRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    }

    async function playTrack(index) {
        if(index < 0 || index >= queue.length) return;
        
        currentTrackIndex = index;
        const track = queue[currentTrackIndex];
        currentTrackId = track.id;
        
        // Show Now Playing tab and switch to it immediately
        navPlayer.style.display = 'flex';
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        navPlayer.classList.add('active');
        switchView('player');
        
        // Update big art
        npBigTitle.textContent = track.name;
        npBigArtist.textContent = track.artists;
        npBigArt.src = track.cover_art || 'https://via.placeholder.com/350';
        
        // Background cache update for Home page
        const primaryArtist = track.artists.split(',')[0].trim();
        
        // Update recently played tracks
        let recentTracks = JSON.parse(localStorage.getItem('recentlyPlayedTracks')) || [];
        recentTracks = recentTracks.filter(t => t.id !== track.id);
        recentTracks.unshift(track);
        if (recentTracks.length > 8) recentTracks.pop();
        localStorage.setItem('recentlyPlayedTracks', JSON.stringify(recentTracks));

        if (!recentSearches.includes(primaryArtist)) {
            recentSearches.unshift(primaryArtist);
            if(recentSearches.length > 10) recentSearches.pop();
            localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
        }
        
        fetch(`/api/search?q=${encodeURIComponent(primaryArtist + " hits")}`)
            .then(res => res.json())
            .then(data => {
                if(data.results) {
                    localStorage.setItem('cachedRecShelf', JSON.stringify(data.results));
                    localStorage.setItem('cachedRecTitle', `Because you like ${primaryArtist}`);
                }
            }).catch(e => {});
        
        // Always re-render queue for player view since we just switched to it
        renderPlayerViewQueue();
        
        document.querySelectorAll('.track-row').forEach(row => {
            if(row.getAttribute('data-track-id') === track.id) {
                row.classList.add('playing');
            } else {
                row.classList.remove('playing');
            }
        });
        
        npTitle.textContent = track.name;
        npArtist.textContent = track.artists;
        npArtwork.style.backgroundImage = `url(${track.cover_art})`;
        totalTimeEl.textContent = track.duration;
        updateMainLikeBtn(track);
        
        // Pause any currently playing audio immediately so they don't overlap while loading
        isPlaying = false;
        nativeAudio.pause();
        nativeAudio.removeAttribute('src');
        nativeAudio.load();
        
        // Remove loading state on play
        if (urlCache[track.id]) {
            nativeAudio.src = urlCache[track.id];
            nativeAudio.play().catch(e => console.warn('Play error:', e));
            isPlaying = true;
            playBtnIcon.className = 'ph-fill ph-pause';
            artworkWrapper.classList.add('spin');
            npBigArt.classList.remove('loading-pulse');
            preloadNext(index + 1); 
            return;
        }

        // Add loading state
        playBtnIcon.className = 'ph-fill ph-spinner-gap spin-icon'; 
        artworkWrapper.classList.remove('spin');
        npBigArt.classList.add('loading-pulse');
        
        try {
            const primaryArtist = track.artists.split(',')[0].trim();
            const query = `${track.name} ${primaryArtist}`;
            const response = await fetch(`/api/play?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if(data.url) {
                urlCache[track.id] = data.url;
                if (currentTrackIndex === index) {
                    nativeAudio.src = data.url;
                    nativeAudio.play().catch(e => console.warn('Play error:', e));
                    isPlaying = true;
                    playBtnIcon.className = 'ph-fill ph-pause';
                    artworkWrapper.classList.add('spin');
                    npBigArt.classList.remove('loading-pulse');
                    preloadNext(index + 1); 
                }
            } else {
                if (currentTrackIndex === index) playNext(); 
            }
        } catch(err) {
            if (currentTrackIndex === index) playNext();
        }
    }

    function playNext() {
        if (currentTrackIndex < queue.length - 1) {
            playTrack(currentTrackIndex + 1);
        } else {
            currentTrackIndex = -1;
            isPlaying = false;
            playBtnIcon.className = 'ph-fill ph-play';
            artworkWrapper.classList.remove('spin');
        }
    }
    
    function playPrev() {
        if (currentTrackIndex > 0) {
            playTrack(currentTrackIndex - 1);
        } else {
            nativeAudio.currentTime = 0;
        }
    }

    playBtn.addEventListener('click', () => {
        if(!nativeAudio.src) return;
        if (isPlaying) {
            nativeAudio.pause();
            playBtnIcon.className = 'ph-fill ph-play';
            artworkWrapper.classList.remove('spin');
            isPlaying = false;
        } else {
            nativeAudio.play().catch(e => console.warn('Play error:', e));
            playBtnIcon.className = 'ph-fill ph-pause';
            artworkWrapper.classList.add('spin');
            isPlaying = true;
        }
    });

    nextBtn.addEventListener('click', playNext);
    prevBtn.addEventListener('click', playPrev);

    progressBarContainer.addEventListener('click', (e) => {
        if(!nativeAudio.src || !nativeAudio.duration) return;
        const rect = progressBarContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        nativeAudio.currentTime = percent * nativeAudio.duration;
    });

    // Volume Control
    volumeBarContainer.addEventListener('click', (e) => {
        const rect = volumeBarContainer.getBoundingClientRect();
        let percent = (e.clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));
        nativeAudio.volume = percent;
        volumeBar.style.width = `${percent * 100}%`;
        
        if (percent === 0) volumeIcon.className = 'ph-fill ph-speaker-none volume-icon';
        else if (percent < 0.5) volumeIcon.className = 'ph-fill ph-speaker-low volume-icon';
        else volumeIcon.className = 'ph-fill ph-speaker-high volume-icon';
    });
    
    let isMuted = false;
    let lastVolume = 1;
    volumeIcon.addEventListener('click', () => {
        if (isMuted) {
            nativeAudio.volume = lastVolume;
            volumeBar.style.width = `${lastVolume * 100}%`;
            volumeIcon.className = lastVolume < 0.5 ? 'ph-fill ph-speaker-low volume-icon' : 'ph-fill ph-speaker-high volume-icon';
            isMuted = false;
        } else {
            lastVolume = nativeAudio.volume || 1;
            nativeAudio.volume = 0;
            volumeBar.style.width = `0%`;
            volumeIcon.className = 'ph-fill ph-speaker-slash volume-icon';
            isMuted = true;
        }
    });

    nativeAudio.addEventListener('timeupdate', () => {
        if(nativeAudio.duration) {
            const progress = (nativeAudio.currentTime / nativeAudio.duration) * 100;
            progressBar.style.width = `${progress}%`;
            
            const curMins = Math.floor(nativeAudio.currentTime / 60);
            const curSecs = Math.floor(nativeAudio.currentTime % 60);
            currentTimeEl.textContent = `${curMins}:${curSecs.toString().padStart(2, '0')}`;
        }
    });

    nativeAudio.addEventListener('ended', () => {
        playNext();
    });

    nativeAudio.addEventListener('waiting', () => {
        playBtnIcon.className = 'ph-fill ph-spinner-gap spin-icon';
        artworkWrapper.classList.remove('spin');
    });

    nativeAudio.addEventListener('playing', () => {
        if (isPlaying) {
            playBtnIcon.className = 'ph-fill ph-pause';
            artworkWrapper.classList.add('spin');
        }
    });

    nativeAudio.addEventListener('error', () => {
        if (isPlaying) {
            console.error("Audio streaming error, skipping to next track");
            playNext();
        }
    });

    // Home view logic
    async function loadHomeData() {
        const recommendedShelf = document.getElementById('recommended-shelf');
        const trendingShelf = document.getElementById('trending-shelf');
        
        // Dynamic Greeting
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
        document.getElementById('greeting-title').textContent = greeting;

        // Recently Played Small Cards
        const recentTracks = JSON.parse(localStorage.getItem('recentlyPlayedTracks')) || [];
        const recentSection = document.getElementById('recently-played-section');
        const recentGrid = document.getElementById('recently-played-grid');
        
        if (recentTracks.length > 0) {
            recentSection.style.display = 'block';
            recentGrid.innerHTML = '';
            recentTracks.slice(0, 6).forEach((track, index) => {
                const card = document.createElement('div');
                card.className = 'recent-small-card';
                card.innerHTML = `
                    <img src="${track.cover_art || 'https://via.placeholder.com/64'}" alt="">
                    <div class="info">${track.name}</div>
                `;
                card.addEventListener('click', () => {
                    queue = recentTracks;
                    playTrack(index);
                });
                recentGrid.appendChild(card);
            });
        } else {
            recentSection.style.display = 'none';
        }

        // Made For You (Algorithm based on recent history)
        const cachedRec = localStorage.getItem('cachedRecShelf');
        const cachedRecTitle = localStorage.getItem('cachedRecTitle');
        let recQuery = 'Arijit Singh';
        if (recentTracks.length > 0) {
            recQuery = recentTracks[0].artists.split(',')[0].trim();
        }
        
        document.getElementById('recommendation-title').textContent = cachedRecTitle || `More like ${recQuery}`;
        
        if (cachedRec) {
            renderCards(JSON.parse(cachedRec), recommendedShelf);
            fetchCardsData(recQuery + " mix", recommendedShelf, 'cachedRecShelf', true);
        } else {
            fetchCardsData(recQuery + " hits", recommendedShelf, 'cachedRecShelf', false);
        }
        
        const cachedTrending = localStorage.getItem('cachedTrendingShelf');
        if (cachedTrending) {
            renderCards(JSON.parse(cachedTrending), trendingShelf);
        } else {
            fetchCardsData('Global Hits', trendingShelf, 'cachedTrendingShelf', false);
        }
    }

    function renderCards(results, container) {
        container.innerHTML = '';
        results.slice(0, 10).forEach((track, index) => {
            const card = document.createElement('div');
            card.className = 'music-card';
            card.innerHTML = `
                <img src="${track.cover_art || 'https://via.placeholder.com/150'}" alt="">
                <button class="card-play-btn"><i class="ph-fill ph-play"></i></button>
                <h4>${track.name}</h4>
                <p>${track.artists}</p>
            `;
            card.addEventListener('click', () => {
                queue = results.slice(0, 10);
                playTrack(index);
            });
            container.appendChild(card);
        });
    }

    async function fetchCardsData(query, container, cacheKey, silent = false) {
        if (!silent) container.innerHTML = '<div style="color:var(--text-muted);">Loading...</div>';
        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.results) {
                localStorage.setItem(cacheKey, JSON.stringify(data.results));
                if (cacheKey === 'cachedRecShelf') {
                    localStorage.setItem('cachedRecTitle', `Because you like ${query}`);
                }
                renderCards(data.results, container);
            }
        } catch (error) {
            if (!silent) container.innerHTML = 'Failed to load';
        }
    }
});
