class LeaderboardComparison {
    constructor() {
        console.log('LeaderboardComparison constructor called');
        this.leaderboardData = null;
        this.mapsWithUsers = [];
        this.filteredMaps = [];
        this.currentSearchTerm = '';
        this.currentTier = 'all';
        this.currentRequestId = null;
        this.progressPollingInterval = null;
        this.backendUrl = this.getBackendUrl();
        this.init();
    }

    getBackendUrl() {
        // Auto-detect backend URL based on how the page is loaded
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // If loaded from localhost backend, use relative URL
            return '';
        } else {
            // If loaded from file:// protocol, use same origin
            return window.location.origin;
        }
    }

    async init() {
        console.log('Initializing LeaderboardComparison...');
        console.log('Backend URL:', this.backendUrl);
        try {
            await this.loadData();
            this.setupEventListeners();
            this.renderUI();
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }

    async loadData() {
        console.log('Loading data from leaderboard.json...');
        
        try {
            // Load data directly from leaderboard.json file
            console.log('Attempting to fetch leaderboard.json...');
            const response = await fetch('leaderboard.json');
            
            console.log('Fetch response status:', response.status);
            console.log('Fetch response ok:', response.ok);
            
            if (!response.ok) {
                throw new Error(`Failed to load leaderboard.json: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Data parsed successfully, structure:', Object.keys(data));
            
            if (data && data.maps) {
                console.log(`Found ${data.maps.length} maps in data`);
                this.leaderboardData = data;
                this.processMapsData();
                this.renderUI();
                console.log('Data loaded successfully from leaderboard.json');
            } else {
                console.error('Invalid data format in leaderboard.json - missing maps array');
                this.showError('Invalid data format. Please check leaderboard.json file.');
            }
        } catch (error) {
            console.error('Error loading leaderboard.json:', error);
            this.showError(`Failed to load leaderboard.json: ${error.message}`);
        }
    }

    processMapsData() {
        console.log('Processing maps data...');
        console.log('Total maps in leaderboardData:', this.leaderboardData.maps.length);
        
        // Filter maps that have leaderboard data for at least one user
        this.mapsWithUsers = this.leaderboardData.maps.filter(map => {
            const hasLeaderboard = map.leaderboard;
            const hasUsers = hasLeaderboard && map.leaderboard.users;
            const hasEnoughUsers = hasUsers && map.leaderboard.users.length >= 1;
            
            console.log(`Map "${map.map.name}": hasLeaderboard=${hasLeaderboard}, hasUsers=${hasUsers}, userCount=${hasUsers ? map.leaderboard.users.length : 0}`);
            
            return hasEnoughUsers;
        });
        
        console.log('Maps with users after filtering:', this.mapsWithUsers.length);
        this.filteredMaps = [...this.mapsWithUsers];
        console.log('Filtered maps initialized:', this.filteredMaps.length);
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.currentSearchTerm = e.target.value;
            this.applyFilters();
        });

        // Add event listeners for tier filter buttons
        const tierButtons = document.querySelectorAll('.tier-btn');
        tierButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Remove active class from all buttons
                tierButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                // Update current tier and apply filters
                this.currentTier = e.target.dataset.tier;
                this.applyFilters();
            });
        });
    }

    applyFilters() {
        // Start with all maps that have users
        let filtered = [...this.mapsWithUsers];
        
        // Apply search filter
        if (this.currentSearchTerm) {
            filtered = filtered.filter(map => 
                map.map.name.toLowerCase().includes(this.currentSearchTerm.toLowerCase())
            );
        }
        
        // Apply tier filter
        if (this.currentTier !== 'all') {
            filtered = filtered.filter(map => {
                const tier = map.map.tier;
                return tier !== null && tier.toString() === this.currentTier;
            });
        }
        
        this.filteredMaps = filtered;
        this.renderMaps();
        this.renderSidebar(); // Update sidebar with new filtered stats
    }

    renderUI() {
        this.renderSidebar();
        this.renderMaps();
    }

    renderSidebar() {
        console.log('renderSidebar called, mapsWithUsers length:', this.mapsWithUsers.length);
        if (!this.mapsWithUsers.length) return;

        // Find the first map that has both users for sidebar display
        const mapWithBothUsers = this.mapsWithUsers.find(map => 
            map.leaderboard && map.leaderboard.users && map.leaderboard.users.length === 2
        );
        
        console.log('mapWithBothUsers:', mapWithBothUsers ? 'found' : 'not found');
        
        // If no map has both users, find the first available user(s)
        let aroundUser = null;
        let friendsUser = null;
        
        if (mapWithBothUsers) {
            aroundUser = mapWithBothUsers.leaderboard.users.find(u => u.filter_type === 'around');
            friendsUser = mapWithBothUsers.leaderboard.users.find(u => u.filter_type === 'friends');
        } else {
            // Fallback: find any users from the available maps
            aroundUser = this.mapsWithUsers.find(map => 
                map.leaderboard.users.some(u => u.filter_type === 'around')
            )?.leaderboard.users.find(u => u.filter_type === 'around');
            
            friendsUser = this.mapsWithUsers.find(map => 
                map.leaderboard.users.some(u => u.filter_type === 'friends')
            )?.leaderboard.users.find(u => u.filter_type === 'friends');
        }

        console.log('aroundUser:', aroundUser ? aroundUser.alias : 'not found');
        console.log('friendsUser:', friendsUser ? friendsUser.alias : 'not found');

        // Calculate statistics based on filtered maps
        const stats = this.calculateStats(this.filteredMaps);
        console.log('Stats:', stats);

        // Update sidebar title based on current tier
        const overallScoreEl = document.querySelector('.overall-score h2');
        if (overallScoreEl) {
            let title = '🏆 Score';
            if (this.currentTier !== 'all') {
                title = `🏆 Tier ${this.currentTier} Score`;
            }
            overallScoreEl.textContent = title;
        }

        // Add fetch date display
        let fetchDateHTML = '';
        if (this.leaderboardData.metadata && this.leaderboardData.metadata.fetch_date) {
            const fetchDate = new Date(this.leaderboardData.metadata.fetch_date);
            const formattedDate = fetchDate.toLocaleDateString() + ' ' + fetchDate.toLocaleTimeString();
            fetchDateHTML = `<div class="fetch-date">Updated: ${formattedDate}</div>`;
        }

        // Render user comparison (only if users exist)
        let userComparisonHTML = '';
        if (aroundUser) {
            userComparisonHTML += `
                <div class="user-row">
                    <img src="${aroundUser.avatarURL || ''}" class="user-avatar" onerror="this.style.display='none'" />
                    <div class="user-info">
                        <div class="user-name">${aroundUser.alias}</div>
                        <div class="user-wins">Wins: ${stats.aroundWins}</div>
                    </div>
                </div>
            `;
        }
        
        if (friendsUser) {
            userComparisonHTML += `
                <div class="user-row">
                    <img src="${friendsUser.avatarURL || ''}" class="user-avatar" onerror="this.style.display='none'" />
                    <div class="user-info">
                        <div class="user-name">${friendsUser.alias}</div>
                        <div class="user-wins">Wins: ${stats.friendsWins}</div>
                    </div>
                </div>
            `;
        }

        console.log('Setting userComparison HTML');
        const userComparisonEl = document.getElementById('userComparison');
        if (userComparisonEl) {
            userComparisonEl.innerHTML = fetchDateHTML + userComparisonHTML;
            console.log('userComparison element updated');
        } else {
            console.error('userComparison element not found');
        }
        
        const tiesEl = document.getElementById('ties');
        if (tiesEl) {
            tiesEl.innerHTML = `<div class="ties-display">Ties: ${stats.ties}</div>`;
            console.log('ties element updated');
        } else {
            console.error('ties element not found');
        }

        // Render leader
        let leaderHTML = '';
        if (aroundUser && friendsUser) {
            if (stats.aroundWins > stats.friendsWins) {
                leaderHTML = `<div class="leader-display leading">🎯 ${aroundUser.alias} is Leading!</div>`;
            } else if (stats.friendsWins > stats.aroundWins) {
                leaderHTML = `<div class="leader-display leading">🎯 ${friendsUser.alias} is Leading!</div>`;
            } else {
                leaderHTML = `<div class="leader-display tie">🤝 It's a Tie!</div>`;
            }
        } else {
            leaderHTML = `<div class="leader-display">📊 Score Comparison</div>`;
        }
        
        const leaderEl = document.getElementById('leader');
        if (leaderEl) {
            leaderEl.innerHTML = leaderHTML;
            console.log('leader element updated');
        } else {
            console.error('leader element not found');
        }
    }

    calculateStats(maps = null) {
        // Use provided maps or fall back to all maps with users
        const mapsToProcess = maps || this.mapsWithUsers;
        
        let aroundWins = 0;
        let friendsWins = 0;
        let ties = 0;

        mapsToProcess.forEach(map => {
            const users = map.leaderboard.users;
            const aroundUser = users.find(u => u.filter_type === 'around');
            const friendsUser = users.find(u => u.filter_type === 'friends');

            // Case 1: Both users completed - compare times
            if (aroundUser && friendsUser && 
                aroundUser.time !== null && friendsUser.time !== null &&
                aroundUser.time !== undefined && friendsUser.time !== undefined) {
                if (aroundUser.time < friendsUser.time) {
                    aroundWins++;
                } else if (friendsUser.time < aroundUser.time) {
                    friendsWins++;
                } else {
                    ties++;
                }
            }
            // Case 2: Only around user completed - automatic win for around user
            else if (aroundUser && aroundUser.time !== null && aroundUser.time !== undefined) {
                aroundWins++;
            }
            // Case 3: Only friends user completed - automatic win for friends user
            else if (friendsUser && friendsUser.time !== null && friendsUser.time !== undefined) {
                friendsWins++;
            }
            // Case 4: Neither completed - no stats counted
        });

        return { aroundWins, friendsWins, ties };
    }

    renderMaps() {
        const mapsList = document.getElementById('mapsList');
        const noResults = document.getElementById('noResults');

        if (this.filteredMaps.length === 0) {
            mapsList.innerHTML = '';
            noResults.style.display = 'block';
            return;
        }

        noResults.style.display = 'none';
        
        // Sort maps by name
        const sortedMaps = [...this.filteredMaps].sort((a, b) => 
            a.map.name.localeCompare(b.map.name)
        );

        mapsList.innerHTML = sortedMaps.map(map => this.renderMapCard(map)).join('');
    }

    renderMapCard(map) {
        const users = map.leaderboard.users;
        const aroundUser = users.find(u => u.filter_type === 'around');
        const friendsUser = users.find(u => u.filter_type === 'friends');

        const uniqueCompletions = map.map.unique_completions || 0;
        const tier = map.map.tier;
        
        // Determine winner and loser (only if both users completed)
        let aroundUserClass = '';
        let friendsUserClass = '';
        let timeDifference = null;
        
        if (aroundUser && friendsUser && 
            aroundUser.time !== null && friendsUser.time !== null &&
            aroundUser.time !== undefined && friendsUser.time !== undefined) {
            if (aroundUser.time < friendsUser.time) {
                aroundUserClass = 'winner';
                friendsUserClass = 'loser';
                timeDifference = friendsUser.time - aroundUser.time;
            } else if (friendsUser.time < aroundUser.time) {
                friendsUserClass = 'winner';
                aroundUserClass = 'loser';
                timeDifference = aroundUser.time - friendsUser.time;
            } else {
                ties++;
            }
        }
        
        // Use larger image if available, otherwise use small thumbnail
        const imageUrl = map.map.image || map.map.thumbnail || '';
        
        // Create tier display
        let tierDisplay = '';
        if (tier !== null && tier !== undefined) {
            const tierColor = tier === 1 ? '#4CAF50' : tier === 2 ? '#FFC107' : '#F44336';
            tierDisplay = `<span class="tier-badge" style="background-color: ${tierColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; margin-left: 8px;">T${tier}</span>`;
        }
        
        return `
            <div class="map-card">
                <div class="map-header">
                    <img src="${imageUrl}" class="map-thumbnail" onerror="this.style.display='none'" />
                    <div class="map-info">
                        <h3>${map.map.name}${tierDisplay}</h3>
                        <div class="map-completions">📊 ${uniqueCompletions.toLocaleString()} unique completions</div>
                    </div>
                </div>
                
                <div class="user-comparison">
                    ${aroundUser ? this.renderUserCard(aroundUser, uniqueCompletions, aroundUserClass, timeDifference) : this.renderEmptyUserCard('around')}
                    ${friendsUser ? this.renderUserCard(friendsUser, uniqueCompletions, friendsUserClass, timeDifference) : this.renderEmptyUserCard('friends')}
                </div>
            </div>
        `;
    }

    renderUserCard(user, uniqueCompletions, cssClass = '', timeDifference = null) {
        return `
            <div class="user-card ${cssClass}">
                <img src="${user.avatarURL || ''}" class="user-avatar" onerror="this.style.display='none'" />
                <div class="user-name">${user.alias}</div>
                <div class="rank-info">#${user.rank.toLocaleString()}/${uniqueCompletions.toLocaleString()}</div>
                <div class="time-display">
                    ${this.formatTime(user.time)}
                    ${timeDifference ? `<span class="time-difference">+${this.formatTime(timeDifference)}</span>` : ''}
                </div>
            </div>
        `;
    }

    renderEmptyUserCard(userType) {
        const userName = userType === 'around' ? 'User' : 'User';
        return `
            <div class="user-card not-completed">
                <div class="user-avatar-placeholder">❓</div>
                <div class="user-name">${userName}</div>
                <div class="rank-info">Not Completed</div>
                <div class="time-display">--:---</div>
            </div>
        `;
    }

    formatTime(timeSeconds) {
        if (timeSeconds === null || timeSeconds === undefined) {
            return '--:---';
        }
        
        const minutes = Math.floor(timeSeconds / 60);
        const seconds = (timeSeconds % 60).toFixed(2);
        const [wholeSeconds, milliseconds] = seconds.split('.');
        
        // Ensure seconds are padded to 2 digits and milliseconds to 2 digits
        const paddedSeconds = wholeSeconds.padStart(2, '0');
        const paddedMilliseconds = milliseconds.padEnd(2, '0').substring(0, 2);
        
        return `${minutes}:${paddedSeconds}.${paddedMilliseconds}`;
    }

    showError(message) {
        const mapsList = document.getElementById('mapsList');
        const noResults = document.getElementById('noResults');
        
        if (mapsList) {
            mapsList.innerHTML = 
                `<div class="no-results">
                    <p><strong>Error:</strong> ${message}</p>
                    <p><small>Check browser console for more details.</small></p>
                </div>`;
        }
        
        if (noResults) {
            noResults.style.display = 'none';
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    // DOM is still loading, wait for it
    console.log('DOM is still loading...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, initializing...');
        try {
            new LeaderboardComparison();
            console.log('LeaderboardComparison initialized successfully');
        } catch (error) {
            console.error('Error initializing LeaderboardComparison:', error);
        }
    });
} else {
    // DOM is already loaded
    console.log('DOM already loaded, initializing immediately...');
    try {
        new LeaderboardComparison();
        console.log('LeaderboardComparison initialized successfully (immediate)');
    } catch (error) {
        console.error('Error initializing LeaderboardComparison (immediate):', error);
    }
}
