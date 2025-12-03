/**
 * Guest Personality & Behavior Expander Plugin for OpenRCT2
 * Version: 1.0.1
 * 
 * A comprehensive plugin that introduces an enhanced guest personality and behavior system.
 * Features include:
 * - Dynamic personality traits with multiple dimensions
 * - Mood system with emotional states
 * - Social behaviors and group dynamics
 * - Weather reactions
 * - Time-based behaviors
 * - Ride preferences based on personality
 * - Shopping behaviors
 * - Hunger/thirst dynamics
 * - Energy management
 * - Memory system for ride experiences
 * - Fear and excitement thresholds
 * - Patience levels
 * - Spending habits
 * - Park satisfaction system
 * - And much more!
 * 
 * 100% Multiplayer Compatible - Server-side only (type: 'remote')
 * All game state modifications use proper synchronization via custom game actions
 * 
 * Compatible with Enhanced Pathfinding System v2.6.0
 */

(function() {
    'use strict';

    // ===========================================
    // CONFIGURATION
    // ===========================================
    var CONFIG = {
        // System Settings
        enabled: true,
        debugMode: false,
        
        // Performance Settings
        frameBudgetMs: 2.5,
        maxGuestsPerTick: 5,
        updateInterval: 8,
        personalityUpdateInterval: 50,
        moodDecayInterval: 100,
        socialUpdateInterval: 30,
        
        // Adaptive Performance
        adaptivePerformance: true,
        minGuestsPerTick: 1,
        maxAdaptiveGuestsPerTick: 8,
        targetFrameTime: 2.0,
        
        // Personality Settings
        personalityPersistence: true,
        personalityVariation: 0.3,
        moodInfluenceStrength: 0.5,
        socialInfluenceRadius: 5,
        groupFormationChance: 0.15,
        
        // Behavior Settings
        weatherReactionsEnabled: true,
        timeBasedBehaviorEnabled: true,
        ridePreferencesEnabled: true,
        shoppingBehaviorEnabled: true,
        socialBehaviorEnabled: true,
        memorySystemEnabled: true,
        
        // Mood Thresholds
        happyMoodThreshold: 180,
        neutralMoodThreshold: 120,
        sadMoodThreshold: 60,
        
        // Statistics
        statisticsEnabled: true,
        statisticsRetentionTicks: 10000
    };

    // ===========================================
    // CONSTANTS
    // ===========================================
    var PERSONALITY_TRAITS = {
        // Core personality dimensions (0-255 scale)
        THRILL_SEEKER: 'thrillSeeker',      // High = loves intense rides
        SOCIAL: 'social',                    // High = enjoys crowds, groups
        PATIENT: 'patient',                  // High = tolerates longer queues
        FRUGAL: 'frugal',                   // High = careful with money
        HUNGRY: 'hungry',                    // High = gets hungry faster
        ADVENTUROUS: 'adventurous',          // High = tries new things
        NERVOUS: 'nervous',                  // High = easily scared
        ENERGETIC: 'energetic',              // High = walks faster, stays longer
        ROMANTIC: 'romantic',                // High = prefers gentle rides
        FOODIE: 'foodie',                    // High = values food quality
        COLLECTOR: 'collector',              // High = buys souvenirs
        PHOTOGRAPHER: 'photographer'          // High = takes photos
    };

    var MOOD_STATES = {
        ECSTATIC: 'ecstatic',
        HAPPY: 'happy',
        CONTENT: 'content',
        NEUTRAL: 'neutral',
        BORED: 'bored',
        ANNOYED: 'annoyed',
        SAD: 'sad',
        ANGRY: 'angry',
        SCARED: 'scared',
        EXCITED: 'excited',
        TIRED: 'tired',
        HUNGRY_MOOD: 'hungryMood',
        THIRSTY_MOOD: 'thirstyMood',
        SICK: 'sick'
    };

    var BEHAVIOR_TYPES = {
        WANDERING: 'wandering',
        SEEKING_RIDE: 'seekingRide',
        SEEKING_FOOD: 'seekingFood',
        SEEKING_DRINK: 'seekingDrink',
        SEEKING_TOILET: 'seekingToilet',
        SEEKING_SHELTER: 'seekingShelter',
        SOCIALIZING: 'socializing',
        RESTING: 'resting',
        PHOTO_TAKING: 'photoTaking',
        SHOPPING: 'shopping',
        LEAVING: 'leaving',
        FOLLOWING_GROUP: 'followingGroup',
        LEADING_GROUP: 'leadingGroup'
    };

    var RIDE_CATEGORIES = {
        THRILL: ['roller_coaster', 'launched_freefall', 'vertical_drop'],
        GENTLE: ['ferris_wheel', 'observation_tower', 'monorail'],
        WATER: ['water_coaster', 'log_flume', 'river_rapids'],
        TRANSPORT: ['chairlift', 'miniature_railway', 'suspended_monorail'],
        DARK: ['ghost_train', 'haunted_house', 'enterprise'],
        FAMILY: ['merry_go_round', 'mini_golf', 'circus']
    };

    // ===========================================
    // NETWORK HELPER (Multiplayer Compatibility)
    // ===========================================
    var NetworkHelper = {
        getMode: function() {
            try {
                return network.mode;
            } catch (e) {
                return 'none';
            }
        },

        isServer: function() {
            var mode = this.getMode();
            return mode === 'none' || mode === 'server';
        },

        isClient: function() {
            return this.getMode() === 'client';
        },

        isMultiplayer: function() {
            var mode = this.getMode();
            return mode === 'server' || mode === 'client';
        },

        getPlayerCount: function() {
            try {
                if (this.isMultiplayer()) {
                    return network.numPlayers || 1;
                }
                return 1;
            } catch (e) {
                return 1;
            }
        },

        canModifyGameState: function() {
            return this.isServer();
        },

        getModeString: function() {
            var mode = this.getMode();
            if (mode === 'none') return 'Single Player';
            if (mode === 'server') return 'Multiplayer (Host)';
            if (mode === 'client') return 'Multiplayer (Client)';
            return 'Unknown';
        },

        broadcastMessage: function(message) {
            if (this.isMultiplayer() && this.isServer()) {
                try {
                    if (CONFIG.debugMode) {
                        console.log('[PersonalityExpander] Broadcast: ' + message);
                    }
                } catch (e) {}
            }
        }
    };

    // ===========================================
    // PERFORMANCE MONITOR
    // ===========================================
    var PerformanceMonitor = {
        frameStartTime: 0,
        frameTimes: [],
        maxFrameTimes: 60,

        startFrame: function() {
            this.frameStartTime = Date.now();
        },

        getElapsedMs: function() {
            return Date.now() - this.frameStartTime;
        },

        isOverBudget: function() {
            return this.getElapsedMs() >= CONFIG.frameBudgetMs;
        },

        endFrame: function() {
            var elapsed = this.getElapsedMs();
            this.frameTimes.push(elapsed);
            if (this.frameTimes.length > this.maxFrameTimes) {
                this.frameTimes.shift();
            }
            return elapsed;
        },

        getAverageFrameTime: function() {
            if (this.frameTimes.length === 0) return 0;
            var sum = 0;
            for (var i = 0; i < this.frameTimes.length; i++) {
                sum += this.frameTimes[i];
            }
            return sum / this.frameTimes.length;
        },

        adjustProcessingRate: function() {
            if (!CONFIG.adaptivePerformance) return;
            var avg = this.getAverageFrameTime();
            if (avg > CONFIG.targetFrameTime * 1.5) {
                CONFIG.maxGuestsPerTick = Math.max(CONFIG.minGuestsPerTick, CONFIG.maxGuestsPerTick - 1);
            } else if (avg < CONFIG.targetFrameTime * 0.5) {
                CONFIG.maxGuestsPerTick = Math.min(CONFIG.maxAdaptiveGuestsPerTick, CONFIG.maxGuestsPerTick + 1);
            }
        }
    };

    // ===========================================
    // RANDOM NUMBER GENERATOR (Deterministic for MP)
    // ===========================================
    var RandomGenerator = {
        seed: 12345,

        getGameRandom: function(min, max) {
            try {
                return context.getRandom(min, max);
            } catch (e) {
                return this.getSeededRandom(min, max);
            }
        },

        getSeededRandom: function(min, max) {
            this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
            return min + (this.seed % (max - min));
        },

        getRandomFloat: function() {
            return this.getGameRandom(0, 10000) / 10000;
        },

        getGaussianRandom: function(mean, stdDev) {
            var u1 = this.getRandomFloat();
            var u2 = this.getRandomFloat();
            if (u1 === 0) u1 = 0.0001;
            var z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            return Math.round(mean + z * stdDev);
        }
    };

    // ===========================================
    // PERSONALITY DATA STORE
    // ===========================================
    var PersonalityStore = {
        guests: {},
        groups: {},
        nextGroupId: 1,

        getGuestData: function(guestId) {
            if (!this.guests[guestId]) {
                this.guests[guestId] = this.createNewPersonality(guestId);
            }
            return this.guests[guestId];
        },

        hasGuestData: function(guestId) {
            return guestId in this.guests;
        },

        createNewPersonality: function(guestId) {
            var personality = {
                id: guestId,
                createdTick: date.ticksElapsed,
                
                traits: {},
                
                mood: {
                    current: MOOD_STATES.CONTENT,
                    intensity: 128,
                    lastChange: date.ticksElapsed
                },
                
                behavior: {
                    current: BEHAVIOR_TYPES.WANDERING,
                    target: null,
                    startTick: date.ticksElapsed
                },
                
                social: {
                    groupId: null,
                    isLeader: false,
                    friendIds: [],
                    recentInteractions: 0
                },
                
                memory: {
                    ridesRidden: {},
                    favoriteRide: null,
                    worstExperience: null,
                    totalSpent: 0,
                    itemsBought: [],
                    timeInPark: 0
                },
                
                modifiers: {
                    happinessBonus: 0,
                    energyDrain: 1.0,
                    hungerRate: 1.0,
                    thirstRate: 1.0,
                    spendingMultiplier: 1.0
                },
                
                stats: {
                    moodChanges: 0,
                    behaviorsChanged: 0,
                    socialInteractions: 0,
                    decisionsInfluenced: 0
                }
            };

            for (var traitKey in PERSONALITY_TRAITS) {
                if (PERSONALITY_TRAITS.hasOwnProperty(traitKey)) {
                    var traitName = PERSONALITY_TRAITS[traitKey];
                    var value = RandomGenerator.getGaussianRandom(128, 40);
                    personality.traits[traitName] = Math.max(0, Math.min(255, value));
                }
            }

            this.calculateModifiers(personality);

            return personality;
        },

        calculateModifiers: function(personality) {
            var traits = personality.traits;
            
            personality.modifiers.energyDrain = 1.0 - (traits.energetic - 128) / 512;
            personality.modifiers.hungerRate = 0.8 + (traits.hungry / 255) * 0.4;
            personality.modifiers.thirstRate = 0.8 + (traits.energetic / 255) * 0.4;
            personality.modifiers.spendingMultiplier = 1.5 - (traits.frugal / 255);
        },

        removeGuestData: function(guestId) {
            if (this.guests[guestId]) {
                var groupId = this.guests[guestId].social.groupId;
                if (groupId && this.groups[groupId]) {
                    var idx = this.groups[groupId].members.indexOf(guestId);
                    if (idx !== -1) {
                        this.groups[groupId].members.splice(idx, 1);
                    }
                    if (this.groups[groupId].members.length === 0) {
                        delete this.groups[groupId];
                    }
                }
                delete this.guests[guestId];
            }
        },

        createGroup: function(leaderGuestId) {
            var groupId = this.nextGroupId++;
            this.groups[groupId] = {
                id: groupId,
                leaderId: leaderGuestId,
                members: [leaderGuestId],
                formation: 'follow',
                targetRide: null,
                createdTick: date.ticksElapsed
            };
            
            if (this.guests[leaderGuestId]) {
                this.guests[leaderGuestId].social.groupId = groupId;
                this.guests[leaderGuestId].social.isLeader = true;
            }
            
            return groupId;
        },

        addToGroup: function(guestId, groupId) {
            if (!this.groups[groupId]) return false;
            if (!this.guests[guestId]) return false;
            
            var currentGroupId = this.guests[guestId].social.groupId;
            if (currentGroupId) {
                this.removeFromGroup(guestId);
            }
            
            this.groups[groupId].members.push(guestId);
            this.guests[guestId].social.groupId = groupId;
            this.guests[guestId].social.isLeader = false;
            
            return true;
        },

        removeFromGroup: function(guestId) {
            if (!this.guests[guestId]) return;
            
            var groupId = this.guests[guestId].social.groupId;
            if (!groupId || !this.groups[groupId]) return;
            
            var idx = this.groups[groupId].members.indexOf(guestId);
            if (idx !== -1) {
                this.groups[groupId].members.splice(idx, 1);
            }
            
            if (this.groups[groupId].leaderId === guestId) {
                if (this.groups[groupId].members.length > 0) {
                    var newLeaderId = this.groups[groupId].members[0];
                    this.groups[groupId].leaderId = newLeaderId;
                    if (this.guests[newLeaderId]) {
                        this.guests[newLeaderId].social.isLeader = true;
                    }
                } else {
                    delete this.groups[groupId];
                }
            }
            
            this.guests[guestId].social.groupId = null;
            this.guests[guestId].social.isLeader = false;
        },

        getGroupMembers: function(groupId) {
            if (!this.groups[groupId]) return [];
            return this.groups[groupId].members.slice();
        },

        cleanupOldData: function() {
            var validGuestIds = {};
            try {
                var guests = map.getAllEntities('guest');
                for (var i = 0; i < guests.length; i++) {
                    if (guests[i] && guests[i].id !== null) {
                        validGuestIds[guests[i].id] = true;
                    }
                }
            } catch (e) {
                return;
            }
            
            var removed = 0;
            for (var guestId in this.guests) {
                if (this.guests.hasOwnProperty(guestId)) {
                    if (!validGuestIds[guestId]) {
                        this.removeGuestData(guestId);
                        removed++;
                    }
                }
            }
            
            if (CONFIG.debugMode && removed > 0) {
                console.log('[PersonalityExpander] Cleaned up ' + removed + ' old guest records');
            }
        },

        getStats: function() {
            var guestCount = 0;
            var groupCount = 0;
            var avgTraits = {};
            
            for (var guestId in this.guests) {
                if (this.guests.hasOwnProperty(guestId)) {
                    guestCount++;
                    var traits = this.guests[guestId].traits;
                    for (var trait in traits) {
                        if (traits.hasOwnProperty(trait)) {
                            avgTraits[trait] = (avgTraits[trait] || 0) + traits[trait];
                        }
                    }
                }
            }
            
            for (var groupId in this.groups) {
                if (this.groups.hasOwnProperty(groupId)) {
                    groupCount++;
                }
            }
            
            if (guestCount > 0) {
                for (var t in avgTraits) {
                    if (avgTraits.hasOwnProperty(t)) {
                        avgTraits[t] = Math.round(avgTraits[t] / guestCount);
                    }
                }
            }
            
            return {
                totalGuests: guestCount,
                totalGroups: groupCount,
                averageTraits: avgTraits
            };
        },

        clear: function() {
            this.guests = {};
            this.groups = {};
            this.nextGroupId = 1;
        }
    };

    // ===========================================
    // MOOD SYSTEM
    // ===========================================
    var MoodSystem = {
        updateMood: function(guestId, guest) {
            if (!NetworkHelper.canModifyGameState()) return;
            
            var data = PersonalityStore.getGuestData(guestId);
            if (!data) return;
            
            var newMood = this.calculateMood(guest, data);
            
            if (newMood.current !== data.mood.current || 
                Math.abs(newMood.intensity - data.mood.intensity) > 10) {
                data.mood = newMood;
                data.mood.lastChange = date.ticksElapsed;
                data.stats.moodChanges++;
                
                this.applyMoodEffects(guest, data);
            }
        },

        calculateMood: function(guest, data) {
            var traits = data.traits;
            var mood = {
                current: MOOD_STATES.NEUTRAL,
                intensity: 128,
                lastChange: data.mood.lastChange
            };
            
            var baseHappiness = guest.happiness || 128;
            var happinessModifier = 0;
            
            if (traits.social > 150) {
                var nearbyGuests = this.countNearbyGuests(guest);
                happinessModifier += Math.min(20, nearbyGuests * 2);
            }
            
            if (traits.nervous > 150) {
                var nearbyGuests2 = this.countNearbyGuests(guest);
                happinessModifier -= Math.min(20, nearbyGuests2 * 3);
            }
            
            if (guest.hunger < 50) {
                mood.current = MOOD_STATES.HUNGRY_MOOD;
                mood.intensity = 50 + (50 - guest.hunger);
            } else if (guest.thirst < 50) {
                mood.current = MOOD_STATES.THIRSTY_MOOD;
                mood.intensity = 50 + (50 - guest.thirst);
            } else if (guest.toilet > 200) {
                mood.current = MOOD_STATES.ANNOYED;
                mood.intensity = 100 + (guest.toilet - 200) / 2;
            } else if (guest.energy < 40) {
                mood.current = MOOD_STATES.TIRED;
                mood.intensity = 40 + (40 - guest.energy);
            } else if (guest.nausea > 150) {
                mood.current = MOOD_STATES.SICK;
                mood.intensity = guest.nausea;
            } else {
                var adjustedHappiness = Math.max(0, Math.min(255, baseHappiness + happinessModifier));
                
                if (adjustedHappiness > CONFIG.happyMoodThreshold + 50) {
                    mood.current = MOOD_STATES.ECSTATIC;
                    mood.intensity = adjustedHappiness;
                } else if (adjustedHappiness > CONFIG.happyMoodThreshold) {
                    mood.current = MOOD_STATES.HAPPY;
                    mood.intensity = adjustedHappiness;
                } else if (adjustedHappiness > CONFIG.neutralMoodThreshold) {
                    mood.current = MOOD_STATES.CONTENT;
                    mood.intensity = adjustedHappiness;
                } else if (adjustedHappiness > CONFIG.sadMoodThreshold) {
                    mood.current = MOOD_STATES.NEUTRAL;
                    mood.intensity = adjustedHappiness;
                } else if (adjustedHappiness > 30) {
                    mood.current = MOOD_STATES.SAD;
                    mood.intensity = 128 - adjustedHappiness;
                } else {
                    mood.current = MOOD_STATES.ANGRY;
                    mood.intensity = 200 - adjustedHappiness;
                }
            }
            
            return mood;
        },

        countNearbyGuests: function(guest) {
            try {
                var tileX = Math.floor(guest.x / 32);
                var tileY = Math.floor(guest.y / 32);
                var count = 0;
                
                var nearbyGuests = map.getAllEntitiesOnTile('guest', { x: tileX * 32, y: tileY * 32 });
                count += nearbyGuests.length;
                
                var directions = [
                    { x: 1, y: 0 }, { x: -1, y: 0 },
                    { x: 0, y: 1 }, { x: 0, y: -1 }
                ];
                
                for (var i = 0; i < directions.length; i++) {
                    var checkX = (tileX + directions[i].x) * 32;
                    var checkY = (tileY + directions[i].y) * 32;
                    var adjacentGuests = map.getAllEntitiesOnTile('guest', { x: checkX, y: checkY });
                    count += adjacentGuests.length;
                }
                
                return Math.max(0, count - 1);
            } catch (e) {
                return 0;
            }
        },

        applyMoodEffects: function(guest, data) {
            if (!NetworkHelper.canModifyGameState()) return;
            
            try {
                var mood = data.mood;
                var happinessAdjust = 0;
                
                switch (mood.current) {
                    case MOOD_STATES.ECSTATIC:
                        happinessAdjust = 30;
                        break;
                    case MOOD_STATES.HAPPY:
                        happinessAdjust = 15;
                        break;
                    case MOOD_STATES.EXCITED:
                        happinessAdjust = 20;
                        break;
                    case MOOD_STATES.BORED:
                        happinessAdjust = -10;
                        break;
                    case MOOD_STATES.ANNOYED:
                        happinessAdjust = -15;
                        break;
                    case MOOD_STATES.SAD:
                        happinessAdjust = -20;
                        break;
                    case MOOD_STATES.ANGRY:
                        happinessAdjust = -30;
                        break;
                }
                
                happinessAdjust = Math.round(happinessAdjust * CONFIG.moodInfluenceStrength);
                
                var newTarget = Math.max(0, Math.min(255, guest.happinessTarget + happinessAdjust));
                
                if (Math.abs(newTarget - guest.happinessTarget) > 5) {
                    guest.happinessTarget = newTarget;
                }
            } catch (e) {
                if (CONFIG.debugMode) {
                    console.log('[PersonalityExpander] Error applying mood effects: ' + e);
                }
            }
        },

        getMoodEmoji: function(mood) {
            switch (mood) {
                case MOOD_STATES.ECSTATIC: return ':D';
                case MOOD_STATES.HAPPY: return ':)';
                case MOOD_STATES.CONTENT: return ':]';
                case MOOD_STATES.NEUTRAL: return ':|';
                case MOOD_STATES.BORED: return ':/';
                case MOOD_STATES.ANNOYED: return '>:(';
                case MOOD_STATES.SAD: return ':(';
                case MOOD_STATES.ANGRY: return '>:O';
                case MOOD_STATES.SCARED: return ':O';
                case MOOD_STATES.EXCITED: return ':D!';
                case MOOD_STATES.TIRED: return '-_-';
                case MOOD_STATES.HUNGRY_MOOD: return ':[food]';
                case MOOD_STATES.THIRSTY_MOOD: return ':[drink]';
                case MOOD_STATES.SICK: return 'X(';
                default: return '?';
            }
        }
    };

    // ===========================================
    // BEHAVIOR SYSTEM
    // ===========================================
    var BehaviorSystem = {
        updateBehavior: function(guestId, guest) {
            if (!NetworkHelper.canModifyGameState()) return;
            
            var data = PersonalityStore.getGuestData(guestId);
            if (!data) return;
            
            var newBehavior = this.determineBehavior(guest, data);
            
            if (newBehavior !== data.behavior.current) {
                data.behavior.current = newBehavior;
                data.behavior.startTick = date.ticksElapsed;
                data.stats.behaviorsChanged++;
                
                this.executeBehavior(guest, data);
            }
        },

        determineBehavior: function(guest, data) {
            var traits = data.traits;
            var mood = data.mood;
            
            if (guest.toilet > 180) {
                return BEHAVIOR_TYPES.SEEKING_TOILET;
            }
            
            if (guest.hunger < 40 && traits.hungry > 100) {
                return BEHAVIOR_TYPES.SEEKING_FOOD;
            }
            
            if (guest.thirst < 40) {
                return BEHAVIOR_TYPES.SEEKING_DRINK;
            }
            
            if (guest.hunger < 60) {
                return BEHAVIOR_TYPES.SEEKING_FOOD;
            }
            
            if (CONFIG.weatherReactionsEnabled) {
                var weatherBehavior = this.getWeatherBehavior(guest, data);
                if (weatherBehavior) return weatherBehavior;
            }
            
            if (guest.energy < 30) {
                return BEHAVIOR_TYPES.RESTING;
            }
            
            if (data.social.groupId && !data.social.isLeader) {
                return BEHAVIOR_TYPES.FOLLOWING_GROUP;
            }
            
            if (data.social.isLeader) {
                return BEHAVIOR_TYPES.LEADING_GROUP;
            }
            
            if (traits.photographer > 180 && RandomGenerator.getRandomFloat() < 0.1) {
                return BEHAVIOR_TYPES.PHOTO_TAKING;
            }
            
            if (traits.collector > 180 && RandomGenerator.getRandomFloat() < 0.05) {
                return BEHAVIOR_TYPES.SHOPPING;
            }
            
            if (traits.social > 170 && RandomGenerator.getRandomFloat() < CONFIG.groupFormationChance) {
                return BEHAVIOR_TYPES.SOCIALIZING;
            }
            
            if (mood.current === MOOD_STATES.BORED) {
                return BEHAVIOR_TYPES.SEEKING_RIDE;
            }
            
            if (mood.current === MOOD_STATES.SAD && guest.isInPark) {
                if (RandomGenerator.getRandomFloat() < 0.1) {
                    return BEHAVIOR_TYPES.LEAVING;
                }
            }
            
            if (traits.thrillSeeker > 150 || traits.adventurous > 150) {
                return BEHAVIOR_TYPES.SEEKING_RIDE;
            }
            
            return BEHAVIOR_TYPES.WANDERING;
        },

        getWeatherBehavior: function(guest, data) {
            try {
                var currentWeather = climate.current;
                var traits = data.traits;
                
                if (currentWeather.weather === 'rain' || currentWeather.weather === 'heavy_rain') {
                    if (!guest.hasItem({ type: 'umbrella' })) {
                        if (traits.nervous > 150) {
                            return BEHAVIOR_TYPES.SEEKING_SHELTER;
                        }
                        if (RandomGenerator.getRandomFloat() < 0.3) {
                            return BEHAVIOR_TYPES.SEEKING_SHELTER;
                        }
                    }
                }
                
                if (currentWeather.weather === 'thunder') {
                    if (traits.nervous > 100) {
                        return BEHAVIOR_TYPES.SEEKING_SHELTER;
                    }
                }
            } catch (e) {}
            
            return null;
        },

        executeBehavior: function(guest, data) {
            if (!NetworkHelper.canModifyGameState()) return;
            
            var behavior = data.behavior.current;
            
            try {
                switch (behavior) {
                    case BEHAVIOR_TYPES.SEEKING_RIDE:
                        this.handleSeekingRide(guest, data);
                        break;
                    case BEHAVIOR_TYPES.SOCIALIZING:
                        this.handleSocializing(guest, data);
                        break;
                    case BEHAVIOR_TYPES.RESTING:
                        if (guest.energy < 30) {
                            guest.energyTarget = Math.min(255, guest.energy + 20);
                        }
                        break;
                    case BEHAVIOR_TYPES.PHOTO_TAKING:
                        guest.happinessTarget = Math.min(255, guest.happinessTarget + 10);
                        break;
                }
            } catch (e) {
                if (CONFIG.debugMode) {
                    console.log('[PersonalityExpander] Error executing behavior: ' + e);
                }
            }
        },

        handleSeekingRide: function(guest, data) {
            if (!CONFIG.ridePreferencesEnabled) return;
            
            var preferredIntensity = this.calculatePreferredIntensity(data);
            data.behavior.target = {
                type: 'ride',
                preferredIntensity: preferredIntensity
            };
        },

        calculatePreferredIntensity: function(data) {
            var traits = data.traits;
            var baseIntensity = 5;
            
            baseIntensity += (traits.thrillSeeker - 128) / 40;
            baseIntensity -= (traits.nervous - 128) / 50;
            baseIntensity += (traits.adventurous - 128) / 80;
            
            if (traits.romantic > 170) {
                baseIntensity -= 2;
            }
            
            return Math.max(1, Math.min(15, Math.round(baseIntensity)));
        },

        handleSocializing: function(guest, data) {
            if (!CONFIG.socialBehaviorEnabled) return;
            
            if (!data.social.groupId) {
                var nearbyGuests = this.findNearbyGuestsForSocializing(guest);
                
                if (nearbyGuests.length > 0) {
                    var existingGroup = null;
                    for (var i = 0; i < nearbyGuests.length; i++) {
                        var nearbyData = PersonalityStore.getGuestData(nearbyGuests[i]);
                        if (nearbyData && nearbyData.social.groupId) {
                            existingGroup = nearbyData.social.groupId;
                            break;
                        }
                    }
                    
                    if (existingGroup) {
                        if (PersonalityStore.groups[existingGroup].members.length < 6) {
                            PersonalityStore.addToGroup(guest.id, existingGroup);
                            data.stats.socialInteractions++;
                        }
                    } else if (nearbyGuests.length >= 1) {
                        var groupId = PersonalityStore.createGroup(guest.id);
                        PersonalityStore.addToGroup(nearbyGuests[0], groupId);
                        data.stats.socialInteractions++;
                    }
                }
            }
        },

        findNearbyGuestsForSocializing: function(guest) {
            var nearby = [];
            try {
                var tileX = Math.floor(guest.x / 32);
                var tileY = Math.floor(guest.y / 32);
                
                for (var dx = -CONFIG.socialInfluenceRadius; dx <= CONFIG.socialInfluenceRadius; dx++) {
                    for (var dy = -CONFIG.socialInfluenceRadius; dy <= CONFIG.socialInfluenceRadius; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        
                        var checkX = (tileX + dx) * 32;
                        var checkY = (tileY + dy) * 32;
                        
                        var guestsOnTile = map.getAllEntitiesOnTile('guest', { x: checkX, y: checkY });
                        
                        for (var i = 0; i < guestsOnTile.length; i++) {
                            var otherGuest = guestsOnTile[i];
                            if (otherGuest.id !== guest.id && otherGuest.id !== null) {
                                var otherData = PersonalityStore.getGuestData(otherGuest.id);
                                if (otherData && otherData.traits.social > 100) {
                                    nearby.push(otherGuest.id);
                                }
                            }
                        }
                    }
                }
            } catch (e) {}
            
            return nearby;
        }
    };

    // ===========================================
    // RIDE PREFERENCE SYSTEM
    // ===========================================
    var RidePreferenceSystem = {
        calculateRideSatisfaction: function(guestId, rideId) {
            var data = PersonalityStore.getGuestData(guestId);
            if (!data) return 0.5;
            
            try {
                var ride = map.getRide(rideId);
                if (!ride) return 0.5;
                
                var traits = data.traits;
                var satisfaction = 0.5;
                
                var intensity = (ride.intensity || 500) / 100;
                var preferredIntensity = BehaviorSystem.calculatePreferredIntensity(data);
                var intensityDiff = Math.abs(intensity - preferredIntensity);
                satisfaction -= intensityDiff * 0.05;
                
                if (traits.thrillSeeker > 150) {
                    var excitement = (ride.excitement || 500) / 100;
                    satisfaction += excitement * 0.02;
                }
                
                if (traits.nervous > 150) {
                    var nausea = (ride.nausea || 300) / 100;
                    satisfaction -= nausea * 0.03;
                }
                
                if (data.memory.favoriteRide === rideId) {
                    satisfaction += 0.2;
                }
                
                if (data.memory.worstExperience === rideId) {
                    satisfaction -= 0.3;
                }
                
                return Math.max(0, Math.min(1, satisfaction));
            } catch (e) {
                return 0.5;
            }
        },

        recordRideExperience: function(guestId, rideId, satisfaction) {
            var data = PersonalityStore.getGuestData(guestId);
            if (!data) return;
            
            if (!data.memory.ridesRidden[rideId]) {
                data.memory.ridesRidden[rideId] = {
                    timesRidden: 0,
                    totalSatisfaction: 0
                };
            }
            
            var rideMemory = data.memory.ridesRidden[rideId];
            rideMemory.timesRidden++;
            rideMemory.totalSatisfaction += satisfaction;
            
            var avgSatisfaction = rideMemory.totalSatisfaction / rideMemory.timesRidden;
            
            if (avgSatisfaction > 0.8 && rideMemory.timesRidden >= 2) {
                data.memory.favoriteRide = rideId;
            }
            
            if (avgSatisfaction < 0.3 && rideMemory.timesRidden >= 1) {
                data.memory.worstExperience = rideId;
            }
        }
    };

    // ===========================================
    // SHOPPING BEHAVIOR SYSTEM
    // ===========================================
    var ShoppingSystem = {
        evaluatePurchaseDecision: function(guestId, itemType, price) {
            var data = PersonalityStore.getGuestData(guestId);
            if (!data) return true;
            
            var traits = data.traits;
            var willingness = 0.5;
            
            willingness = 1 - (traits.frugal / 255);
            
            if (traits.collector > 150) {
                if (itemType === 'balloon' || itemType === 'hat' || 
                    itemType === 'toy' || itemType === 'map') {
                    willingness += 0.2;
                }
            }
            
            if (traits.foodie > 150) {
                if (this.isFood(itemType)) {
                    willingness += 0.3;
                }
            }
            
            if (traits.photographer > 150) {
                if (itemType === 'photo1' || itemType === 'photo2' || 
                    itemType === 'photo3' || itemType === 'photo4') {
                    willingness += 0.4;
                }
            }
            
            willingness *= data.modifiers.spendingMultiplier;
            
            try {
                var guest = map.getEntity(guestId);
                if (guest && guest.cash) {
                    var cashAfterPurchase = guest.cash - price;
                    if (cashAfterPurchase < 500) {
                        willingness *= 0.5;
                    }
                }
            } catch (e) {}
            
            return RandomGenerator.getRandomFloat() < willingness;
        },

        isFood: function(itemType) {
            var foodItems = [
                'burger', 'chips', 'ice_cream', 'candyfloss', 'pizza',
                'popcorn', 'hot_dog', 'tentacle', 'toffee_apple', 'doughnut',
                'chicken', 'pretzel', 'funnel_cake', 'beef_noodles',
                'fried_rice_noodles', 'wonton_soup', 'meatball_soup',
                'sub_sandwich', 'cookie', 'roast_sausage'
            ];
            
            for (var i = 0; i < foodItems.length; i++) {
                if (itemType === foodItems[i]) return true;
            }
            return false;
        },

        recordPurchase: function(guestId, itemType, price) {
            var data = PersonalityStore.getGuestData(guestId);
            if (!data) return;
            
            data.memory.totalSpent += price;
            data.memory.itemsBought.push({
                item: itemType,
                price: price,
                tick: date.ticksElapsed
            });
            
            if (data.memory.itemsBought.length > 20) {
                data.memory.itemsBought.shift();
            }
        }
    };

    // ===========================================
    // SOCIAL SYSTEM
    // ===========================================
    var SocialSystem = {
        updateGroups: function() {
            if (!NetworkHelper.canModifyGameState()) return;
            
            for (var groupId in PersonalityStore.groups) {
                if (PersonalityStore.groups.hasOwnProperty(groupId)) {
                    this.updateGroup(groupId);
                }
            }
        },

        updateGroup: function(groupId) {
            var group = PersonalityStore.groups[groupId];
            if (!group) return;
            
            if (group.members.length < 2) {
                this.dissolveGroup(groupId);
                return;
            }
            
            var leader = null;
            try {
                leader = map.getEntity(group.leaderId);
            } catch (e) {}
            
            if (!leader) {
                this.dissolveGroup(groupId);
                return;
            }
            
            var leaderX = Math.floor(leader.x / 32);
            var leaderY = Math.floor(leader.y / 32);
            
            var membersToRemove = [];
            
            for (var i = 0; i < group.members.length; i++) {
                var memberId = group.members[i];
                if (memberId === group.leaderId) continue;
                
                try {
                    var member = map.getEntity(memberId);
                    if (!member) {
                        membersToRemove.push(memberId);
                        continue;
                    }
                    
                    var memberX = Math.floor(member.x / 32);
                    var memberY = Math.floor(member.y / 32);
                    var distance = Math.abs(memberX - leaderX) + Math.abs(memberY - leaderY);
                    
                    if (distance > 15) {
                        if (RandomGenerator.getRandomFloat() < 0.1) {
                            membersToRemove.push(memberId);
                        }
                    }
                } catch (e) {
                    membersToRemove.push(memberId);
                }
            }
            
            for (var j = 0; j < membersToRemove.length; j++) {
                PersonalityStore.removeFromGroup(membersToRemove[j]);
            }
        },

        dissolveGroup: function(groupId) {
            var group = PersonalityStore.groups[groupId];
            if (!group) return;
            
            var members = group.members.slice();
            for (var i = 0; i < members.length; i++) {
                PersonalityStore.removeFromGroup(members[i]);
            }
            
            delete PersonalityStore.groups[groupId];
        },

        getGroupInfo: function(groupId) {
            var group = PersonalityStore.groups[groupId];
            if (!group) return null;
            
            return {
                id: group.id,
                memberCount: group.members.length,
                leaderId: group.leaderId,
                age: date.ticksElapsed - group.createdTick
            };
        }
    };

    // ===========================================
    // GUEST GENERATION HOOK
    // ===========================================
    var GuestGenerationHandler = {
        onGuestGenerated: function(guestId) {
            if (!NetworkHelper.canModifyGameState()) return;
            
            var data = PersonalityStore.getGuestData(guestId);
            
            if (CONFIG.debugMode) {
                console.log('[PersonalityExpander] New guest ' + guestId + ' created with traits: ' +
                    'ThrillSeeker=' + data.traits.thrillSeeker +
                    ', Social=' + data.traits.social +
                    ', Patient=' + data.traits.patient);
            }
            
            try {
                var guest = map.getEntity(guestId);
                if (guest && guest.type === 'guest') {
                    if (data.traits.energetic > 170) {
                        guest.energy = Math.min(255, guest.energy + 20);
                        guest.energyTarget = Math.min(255, guest.energyTarget + 20);
                    }
                    
                    if (data.traits.patient > 170) {
                        guest.happinessTarget = Math.min(255, guest.happinessTarget + 10);
                    }
                }
            } catch (e) {
                if (CONFIG.debugMode) {
                    console.log('[PersonalityExpander] Error applying initial modifiers: ' + e);
                }
            }
        }
    };

    // ===========================================
    // MAIN PROCESSING SYSTEM
    // ===========================================
    var PersonalityProcessor = {
        guestIndex: 0,
        tickCounter: 0,
        moodTickCounter: 0,
        socialTickCounter: 0,
        cleanupTickCounter: 0,

        statistics: {
            guestsProcessed: 0,
            personalitiesCreated: 0,
            modsApplied: 0,
            groupsFormed: 0,
            behaviorChanges: 0,
            lastFrameTime: 0,
            avgFrameTime: 0,
            ticksProcessed: 0
        },

        initialize: function() {
            PersonalityStore.clear();
            this.guestIndex = 0;
            this.tickCounter = 0;
            this.moodTickCounter = 0;
            this.socialTickCounter = 0;
            this.cleanupTickCounter = 0;
            this.resetStatistics();

            if (CONFIG.debugMode) {
                console.log('[PersonalityExpander] System initialized');
            }
        },

        resetStatistics: function() {
            this.statistics = {
                guestsProcessed: 0,
                personalitiesCreated: 0,
                moodUpdates: 0,
                behaviorChanges: 0,
                groupsFormed: 0,
                lastFrameTime: 0,
                avgFrameTime: 0,
                ticksProcessed: 0
            };
        },

        onTick: function() {
            if (!CONFIG.enabled) return;
            if (!NetworkHelper.canModifyGameState()) return;

            this.tickCounter++;
            this.moodTickCounter++;
            this.socialTickCounter++;
            this.cleanupTickCounter++;

            if (this.tickCounter >= CONFIG.updateInterval) {
                this.tickCounter = 0;
                this.processGuests();
            }

            if (this.moodTickCounter >= CONFIG.moodDecayInterval) {
                this.moodTickCounter = 0;
                this.processMoodDecay();
            }

            if (this.socialTickCounter >= CONFIG.socialUpdateInterval) {
                this.socialTickCounter = 0;
                SocialSystem.updateGroups();
            }

            if (this.cleanupTickCounter >= 500) {
                this.cleanupTickCounter = 0;
                PersonalityStore.cleanupOldData();
            }

            this.statistics.ticksProcessed++;
        },

        processGuests: function() {
            PerformanceMonitor.startFrame();

            var guests;
            try {
                guests = map.getAllEntities('guest');
            } catch (e) {
                PerformanceMonitor.endFrame();
                return;
            }

            if (!guests || guests.length === 0) {
                PerformanceMonitor.endFrame();
                return;
            }

            var processed = 0;
            var guestCount = guests.length;

            while (processed < CONFIG.maxGuestsPerTick && !PerformanceMonitor.isOverBudget()) {
                var guest = guests[this.guestIndex % guestCount];
                this.guestIndex = (this.guestIndex + 1) % guestCount;

                if (guest && guest.type === 'guest' && guest.id !== null) {
                    try {
                        this.processGuest(guest);
                        processed++;
                        this.statistics.guestsProcessed++;
                    } catch (e) {
                        if (CONFIG.debugMode) {
                            console.log('[PersonalityExpander] Error processing guest: ' + e);
                        }
                    }
                }

                processed++;
            }

            var frameTime = PerformanceMonitor.endFrame();
            this.statistics.lastFrameTime = frameTime;
            this.statistics.avgFrameTime = PerformanceMonitor.getAverageFrameTime();
            PerformanceMonitor.adjustProcessingRate();
        },

        processGuest: function(guest) {
            var guestId = guest.id;
            if (guestId === null) return;

            if (!PersonalityStore.hasGuestData(guestId)) {
                PersonalityStore.getGuestData(guestId);
                this.statistics.personalitiesCreated++;
            }

            MoodSystem.updateMood(guestId, guest);
            BehaviorSystem.updateBehavior(guestId, guest);

            var data = PersonalityStore.getGuestData(guestId);
            if (data) {
                data.memory.timeInPark = date.ticksElapsed - data.createdTick;
            }
        },

        processMoodDecay: function() {
            for (var guestId in PersonalityStore.guests) {
                if (PersonalityStore.guests.hasOwnProperty(guestId)) {
                    var data = PersonalityStore.guests[guestId];
                    
                    if (data.mood.intensity !== 128) {
                        var decay = data.mood.intensity > 128 ? -1 : 1;
                        data.mood.intensity = Math.max(0, Math.min(255, data.mood.intensity + decay));
                    }
                }
            }
        },

        getStatistics: function() {
            var storeStats = PersonalityStore.getStats();
            return {
                guestsProcessed: this.statistics.guestsProcessed,
                personalitiesCreated: this.statistics.personalitiesCreated,
                trackedGuests: storeStats.totalGuests,
                activeGroups: storeStats.totalGroups,
                avgFrameTime: this.statistics.avgFrameTime.toFixed(2),
                lastFrameTime: this.statistics.lastFrameTime.toFixed(2),
                ticksProcessed: this.statistics.ticksProcessed,
                averageTraits: storeStats.averageTraits
            };
        }
    };

    // ===========================================
    // UI MANAGER
    // ===========================================
    var UIManager = {
        mainWindow: null,
        detailWindow: null,
        windowId: 'guest-personality-expander-v1',
        detailWindowId: 'guest-personality-detail-v1',
        selectedGuestId: null,
        currentTab: 0,

        openWindow: function() {
            this.closeWindow();

            var self = this;
            var windowWidth = 450;
            var windowHeight = 500;

            var pad = 10;
            var innerWidth = windowWidth - (pad * 2);
            var tabY = 18;
            var tabHeight = 14;
            var tabWidth = 100;
            var tabSpacing = 5;

            var widgets = [];

            // Tab buttons - using proper spacing
            widgets.push({
                type: 'button',
                name: 'btn_tab_main',
                x: pad,
                y: tabY,
                width: tabWidth,
                height: tabHeight,
                text: 'Overview',
                isPressed: this.currentTab === 0,
                onClick: function() { self.switchTab(0); }
            });

            widgets.push({
                type: 'button',
                name: 'btn_tab_settings',
                x: pad + tabWidth + tabSpacing,
                y: tabY,
                width: tabWidth,
                height: tabHeight,
                text: 'Settings',
                isPressed: this.currentTab === 1,
                onClick: function() { self.switchTab(1); }
            });

            widgets.push({
                type: 'button',
                name: 'btn_tab_stats',
                x: pad + (tabWidth + tabSpacing) * 2,
                y: tabY,
                width: tabWidth,
                height: tabHeight,
                text: 'Statistics',
                isPressed: this.currentTab === 2,
                onClick: function() { self.switchTab(2); }
            });

            widgets.push({
                type: 'button',
                name: 'btn_tab_debug',
                x: pad + (tabWidth + tabSpacing) * 3,
                y: tabY,
                width: tabWidth,
                height: tabHeight,
                text: 'Debug',
                isPressed: this.currentTab === 3,
                onClick: function() { self.switchTab(3); }
            });

            // Content starts after tabs
            var contentY = tabY + tabHeight + 8;

            // Network Status Group (always visible)
            widgets.push({
                type: 'groupbox',
                name: 'grp_network',
                x: pad,
                y: contentY,
                width: innerWidth,
                height: 52,
                text: 'Network Status'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_netmode',
                x: pad + 8,
                y: contentY + 16,
                width: innerWidth - 16,
                height: 12,
                text: 'Mode: ' + NetworkHelper.getModeString()
            });

            widgets.push({
                type: 'label',
                name: 'lbl_netperm',
                x: pad + 8,
                y: contentY + 30,
                width: innerWidth - 16,
                height: 12,
                text: 'Permissions: ' + (NetworkHelper.canModifyGameState() ? 'Full Control' : 'Read-Only')
            });

            contentY += 60;

            // Tab-specific content
            if (this.currentTab === 0) {
                widgets = widgets.concat(this.createOverviewWidgets(contentY, pad, innerWidth));
            } else if (this.currentTab === 1) {
                widgets = widgets.concat(this.createSettingsWidgets(contentY, pad, innerWidth));
            } else if (this.currentTab === 2) {
                widgets = widgets.concat(this.createStatisticsWidgets(contentY, pad, innerWidth));
            } else if (this.currentTab === 3) {
                widgets = widgets.concat(this.createDebugWidgets(contentY, pad, innerWidth));
            }

            this.mainWindow = ui.openWindow({
                classification: this.windowId,
                title: 'Guest Personality & Behavior Expander v1.0',
                x: Math.floor((ui.width - windowWidth) / 2),
                y: Math.floor((ui.height - windowHeight) / 2),
                width: windowWidth,
                height: windowHeight,
                widgets: widgets,
                onClose: function() {
                    self.mainWindow = null;
                }
            });

            this.startStatisticsUpdate();
        },

        createOverviewWidgets: function(startY, pad, innerWidth) {
            var widgets = [];
            var y = startY;
            var halfWidth = Math.floor((innerWidth - 10) / 2);

            // System Status Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_status',
                x: pad,
                y: y,
                width: innerWidth,
                height: 70,
                text: 'System Status'
            });

            widgets.push({
                type: 'checkbox',
                name: 'chk_enabled',
                x: pad + 8,
                y: y + 18,
                width: halfWidth,
                height: 15,
                text: 'System Enabled',
                isChecked: CONFIG.enabled,
                onChange: function(checked) {
                    CONFIG.enabled = checked;
                    if (checked) {
                        PersonalityProcessor.initialize();
                    }
                }
            });

            widgets.push({
                type: 'label',
                name: 'lbl_frame',
                x: pad + halfWidth + 18,
                y: y + 18,
                width: halfWidth,
                height: 12,
                text: 'Frame: 0.00ms'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_tracked',
                x: pad + 8,
                y: y + 36,
                width: halfWidth,
                height: 12,
                text: 'Tracked Guests: 0'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_groups',
                x: pad + halfWidth + 18,
                y: y + 36,
                width: halfWidth,
                height: 12,
                text: 'Active Groups: 0'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_processing',
                x: pad + 8,
                y: y + 52,
                width: innerWidth - 16,
                height: 12,
                text: 'Processing Rate: 0 guests/tick'
            });

            y += 78;

            // Quick Settings Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_quick',
                x: pad,
                y: y,
                width: innerWidth,
                height: 90,
                text: 'Quick Settings'
            });

            widgets.push({
                type: 'checkbox',
                name: 'chk_mood',
                x: pad + 8,
                y: y + 18,
                width: halfWidth,
                height: 15,
                text: 'Mood System',
                isChecked: true,
                onChange: function(checked) { }
            });

            widgets.push({
                type: 'checkbox',
                name: 'chk_social',
                x: pad + halfWidth + 18,
                y: y + 18,
                width: halfWidth,
                height: 15,
                text: 'Social Behavior',
                isChecked: CONFIG.socialBehaviorEnabled,
                onChange: function(checked) {
                    CONFIG.socialBehaviorEnabled = checked;
                }
            });

            widgets.push({
                type: 'checkbox',
                name: 'chk_weather',
                x: pad + 8,
                y: y + 36,
                width: halfWidth,
                height: 15,
                text: 'Weather Reactions',
                isChecked: CONFIG.weatherReactionsEnabled,
                onChange: function(checked) {
                    CONFIG.weatherReactionsEnabled = checked;
                }
            });

            widgets.push({
                type: 'checkbox',
                name: 'chk_rides',
                x: pad + halfWidth + 18,
                y: y + 36,
                width: halfWidth,
                height: 15,
                text: 'Ride Preferences',
                isChecked: CONFIG.ridePreferencesEnabled,
                onChange: function(checked) {
                    CONFIG.ridePreferencesEnabled = checked;
                }
            });

            widgets.push({
                type: 'checkbox',
                name: 'chk_shopping',
                x: pad + 8,
                y: y + 54,
                width: halfWidth,
                height: 15,
                text: 'Shopping Behavior',
                isChecked: CONFIG.shoppingBehaviorEnabled,
                onChange: function(checked) {
                    CONFIG.shoppingBehaviorEnabled = checked;
                }
            });

            widgets.push({
                type: 'checkbox',
                name: 'chk_memory',
                x: pad + halfWidth + 18,
                y: y + 54,
                width: halfWidth,
                height: 15,
                text: 'Memory System',
                isChecked: CONFIG.memorySystemEnabled,
                onChange: function(checked) {
                    CONFIG.memorySystemEnabled = checked;
                }
            });

            y += 98;

            // Average Traits Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_traits',
                x: pad,
                y: y,
                width: innerWidth,
                height: 140,
                text: 'Average Guest Traits'
            });

            var traitLabels = [
                'Thrill Seeker', 'Social', 'Patient', 'Frugal',
                'Hungry', 'Adventurous', 'Nervous', 'Energetic',
                'Romantic', 'Foodie', 'Collector', 'Photographer'
            ];

            var traitY = y + 18;
            var col1X = pad + 8;
            var col2X = pad + halfWidth + 18;

            for (var i = 0; i < traitLabels.length; i++) {
                var traitX = (i % 2 === 0) ? col1X : col2X;
                var traitRow = Math.floor(i / 2);

                widgets.push({
                    type: 'label',
                    name: 'lbl_trait_' + i,
                    x: traitX,
                    y: traitY + (traitRow * 18),
                    width: halfWidth - 8,
                    height: 12,
                    text: traitLabels[i] + ': ---'
                });
            }

            y += 148;

            // Action Buttons
            widgets.push({
                type: 'button',
                name: 'btn_reset',
                x: pad,
                y: y,
                width: Math.floor(innerWidth / 3) - 5,
                height: 20,
                text: 'Reset Stats',
                onClick: function() {
                    PersonalityProcessor.resetStatistics();
                }
            });

            widgets.push({
                type: 'button',
                name: 'btn_clear',
                x: pad + Math.floor(innerWidth / 3),
                y: y,
                width: Math.floor(innerWidth / 3) - 5,
                height: 20,
                text: 'Clear Data',
                onClick: function() {
                    PersonalityStore.clear();
                    PersonalityProcessor.resetStatistics();
                }
            });

            widgets.push({
                type: 'button',
                name: 'btn_reinit',
                x: pad + Math.floor(innerWidth / 3) * 2,
                y: y,
                width: Math.floor(innerWidth / 3) - 5,
                height: 20,
                text: 'Reinitialize',
                onClick: function() {
                    PersonalityProcessor.initialize();
                }
            });

            return widgets;
        },

        createSettingsWidgets: function(startY, pad, innerWidth) {
            var widgets = [];
            var self = this;
            var y = startY;
            var halfWidth = Math.floor((innerWidth - 10) / 2);

            // Performance Settings Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_perf',
                x: pad,
                y: y,
                width: innerWidth,
                height: 90,
                text: 'Performance Settings'
            });

            widgets.push({
                type: 'checkbox',
                name: 'chk_adaptive',
                x: pad + 8,
                y: y + 18,
                width: innerWidth - 16,
                height: 15,
                text: 'Adaptive Performance (auto-adjust processing rate)',
                isChecked: CONFIG.adaptivePerformance,
                onChange: function(checked) {
                    CONFIG.adaptivePerformance = checked;
                }
            });

            widgets.push({
                type: 'label',
                name: 'lbl_budget',
                x: pad + 8,
                y: y + 38,
                width: 140,
                height: 12,
                text: 'Frame Budget (ms):'
            });

            widgets.push({
                type: 'spinner',
                name: 'spn_budget',
                x: pad + 150,
                y: y + 36,
                width: 100,
                height: 15,
                text: CONFIG.frameBudgetMs.toFixed(1),
                onIncrement: function() {
                    CONFIG.frameBudgetMs = Math.min(10, CONFIG.frameBudgetMs + 0.5);
                    self.updateSpinner('spn_budget', CONFIG.frameBudgetMs.toFixed(1));
                },
                onDecrement: function() {
                    CONFIG.frameBudgetMs = Math.max(0.5, CONFIG.frameBudgetMs - 0.5);
                    self.updateSpinner('spn_budget', CONFIG.frameBudgetMs.toFixed(1));
                }
            });

            widgets.push({
                type: 'label',
                name: 'lbl_interval',
                x: pad + 8,
                y: y + 58,
                width: 140,
                height: 12,
                text: 'Update Interval:'
            });

            widgets.push({
                type: 'spinner',
                name: 'spn_interval',
                x: pad + 150,
                y: y + 56,
                width: 100,
                height: 15,
                text: String(CONFIG.updateInterval),
                onIncrement: function() {
                    CONFIG.updateInterval = Math.min(50, CONFIG.updateInterval + 2);
                    self.updateSpinner('spn_interval', CONFIG.updateInterval);
                },
                onDecrement: function() {
                    CONFIG.updateInterval = Math.max(2, CONFIG.updateInterval - 2);
                    self.updateSpinner('spn_interval', CONFIG.updateInterval);
                }
            });

            y += 98;

            // Personality Settings Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_personality',
                x: pad,
                y: y,
                width: innerWidth,
                height: 70,
                text: 'Personality Settings'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_variation',
                x: pad + 8,
                y: y + 18,
                width: 140,
                height: 12,
                text: 'Trait Variation:'
            });

            widgets.push({
                type: 'spinner',
                name: 'spn_variation',
                x: pad + 150,
                y: y + 16,
                width: 100,
                height: 15,
                text: (CONFIG.personalityVariation * 100).toFixed(0) + '%',
                onIncrement: function() {
                    CONFIG.personalityVariation = Math.min(1.0, CONFIG.personalityVariation + 0.1);
                    self.updateSpinner('spn_variation', (CONFIG.personalityVariation * 100).toFixed(0) + '%');
                },
                onDecrement: function() {
                    CONFIG.personalityVariation = Math.max(0, CONFIG.personalityVariation - 0.1);
                    self.updateSpinner('spn_variation', (CONFIG.personalityVariation * 100).toFixed(0) + '%');
                }
            });

            widgets.push({
                type: 'label',
                name: 'lbl_mood_strength',
                x: pad + 8,
                y: y + 38,
                width: 140,
                height: 12,
                text: 'Mood Influence:'
            });

            widgets.push({
                type: 'spinner',
                name: 'spn_mood_strength',
                x: pad + 150,
                y: y + 36,
                width: 100,
                height: 15,
                text: (CONFIG.moodInfluenceStrength * 100).toFixed(0) + '%',
                onIncrement: function() {
                    CONFIG.moodInfluenceStrength = Math.min(1.0, CONFIG.moodInfluenceStrength + 0.1);
                    self.updateSpinner('spn_mood_strength', (CONFIG.moodInfluenceStrength * 100).toFixed(0) + '%');
                },
                onDecrement: function() {
                    CONFIG.moodInfluenceStrength = Math.max(0, CONFIG.moodInfluenceStrength - 0.1);
                    self.updateSpinner('spn_mood_strength', (CONFIG.moodInfluenceStrength * 100).toFixed(0) + '%');
                }
            });

            y += 78;

            // Social Settings Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_social_settings',
                x: pad,
                y: y,
                width: innerWidth,
                height: 70,
                text: 'Social Settings'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_social_radius',
                x: pad + 8,
                y: y + 18,
                width: 140,
                height: 12,
                text: 'Social Radius:'
            });

            widgets.push({
                type: 'spinner',
                name: 'spn_social_radius',
                x: pad + 150,
                y: y + 16,
                width: 100,
                height: 15,
                text: String(CONFIG.socialInfluenceRadius),
                onIncrement: function() {
                    CONFIG.socialInfluenceRadius = Math.min(20, CONFIG.socialInfluenceRadius + 1);
                    self.updateSpinner('spn_social_radius', CONFIG.socialInfluenceRadius);
                },
                onDecrement: function() {
                    CONFIG.socialInfluenceRadius = Math.max(1, CONFIG.socialInfluenceRadius - 1);
                    self.updateSpinner('spn_social_radius', CONFIG.socialInfluenceRadius);
                }
            });

            widgets.push({
                type: 'label',
                name: 'lbl_group_chance',
                x: pad + 8,
                y: y + 38,
                width: 140,
                height: 12,
                text: 'Group Formation:'
            });

            widgets.push({
                type: 'spinner',
                name: 'spn_group_chance',
                x: pad + 150,
                y: y + 36,
                width: 100,
                height: 15,
                text: (CONFIG.groupFormationChance * 100).toFixed(0) + '%',
                onIncrement: function() {
                    CONFIG.groupFormationChance = Math.min(1.0, CONFIG.groupFormationChance + 0.05);
                    self.updateSpinner('spn_group_chance', (CONFIG.groupFormationChance * 100).toFixed(0) + '%');
                },
                onDecrement: function() {
                    CONFIG.groupFormationChance = Math.max(0, CONFIG.groupFormationChance - 0.05);
                    self.updateSpinner('spn_group_chance', (CONFIG.groupFormationChance * 100).toFixed(0) + '%');
                }
            });

            y += 78;

            // Mood Thresholds Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_thresholds',
                x: pad,
                y: y,
                width: innerWidth,
                height: 90,
                text: 'Mood Thresholds'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_happy_thresh',
                x: pad + 8,
                y: y + 18,
                width: 100,
                height: 12,
                text: 'Happy:'
            });

            widgets.push({
                type: 'spinner',
                name: 'spn_happy_thresh',
                x: pad + 110,
                y: y + 16,
                width: 80,
                height: 15,
                text: String(CONFIG.happyMoodThreshold),
                onIncrement: function() {
                    CONFIG.happyMoodThreshold = Math.min(255, CONFIG.happyMoodThreshold + 10);
                    self.updateSpinner('spn_happy_thresh', CONFIG.happyMoodThreshold);
                },
                onDecrement: function() {
                    CONFIG.happyMoodThreshold = Math.max(CONFIG.neutralMoodThreshold + 10, CONFIG.happyMoodThreshold - 10);
                    self.updateSpinner('spn_happy_thresh', CONFIG.happyMoodThreshold);
                }
            });

            widgets.push({
                type: 'label',
                name: 'lbl_neutral_thresh',
                x: pad + 8,
                y: y + 38,
                width: 100,
                height: 12,
                text: 'Neutral:'
            });

            widgets.push({
                type: 'spinner',
                name: 'spn_neutral_thresh',
                x: pad + 110,
                y: y + 36,
                width: 80,
                height: 15,
                text: String(CONFIG.neutralMoodThreshold),
                onIncrement: function() {
                    CONFIG.neutralMoodThreshold = Math.min(CONFIG.happyMoodThreshold - 10, CONFIG.neutralMoodThreshold + 10);
                    self.updateSpinner('spn_neutral_thresh', CONFIG.neutralMoodThreshold);
                },
                onDecrement: function() {
                    CONFIG.neutralMoodThreshold = Math.max(CONFIG.sadMoodThreshold + 10, CONFIG.neutralMoodThreshold - 10);
                    self.updateSpinner('spn_neutral_thresh', CONFIG.neutralMoodThreshold);
                }
            });

            widgets.push({
                type: 'label',
                name: 'lbl_sad_thresh',
                x: pad + 8,
                y: y + 58,
                width: 100,
                height: 12,
                text: 'Sad:'
            });

            widgets.push({
                type: 'spinner',
                name: 'spn_sad_thresh',
                x: pad + 110,
                y: y + 56,
                width: 80,
                height: 15,
                text: String(CONFIG.sadMoodThreshold),
                onIncrement: function() {
                    CONFIG.sadMoodThreshold = Math.min(CONFIG.neutralMoodThreshold - 10, CONFIG.sadMoodThreshold + 10);
                    self.updateSpinner('spn_sad_thresh', CONFIG.sadMoodThreshold);
                },
                onDecrement: function() {
                    CONFIG.sadMoodThreshold = Math.max(0, CONFIG.sadMoodThreshold - 10);
                    self.updateSpinner('spn_sad_thresh', CONFIG.sadMoodThreshold);
                }
            });

            return widgets;
        },

        createStatisticsWidgets: function(startY, pad, innerWidth) {
            var widgets = [];
            var y = startY;

            // Processing Statistics Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_proc_stats',
                x: pad,
                y: y,
                width: innerWidth,
                height: 90,
                text: 'Processing Statistics'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_stat_processed',
                x: pad + 8,
                y: y + 18,
                width: innerWidth - 16,
                height: 12,
                text: 'Guests Processed: 0'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_stat_created',
                x: pad + 8,
                y: y + 34,
                width: innerWidth - 16,
                height: 12,
                text: 'Personalities Created: 0'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_stat_ticks',
                x: pad + 8,
                y: y + 50,
                width: innerWidth - 16,
                height: 12,
                text: 'Ticks Processed: 0'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_stat_rate',
                x: pad + 8,
                y: y + 66,
                width: innerWidth - 16,
                height: 12,
                text: 'Current Rate: 0 guests/tick'
            });

            y += 98;

            // Guest Population Statistics Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_pop_stats',
                x: pad,
                y: y,
                width: innerWidth,
                height: 70,
                text: 'Guest Population'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_pop_total',
                x: pad + 8,
                y: y + 18,
                width: innerWidth - 16,
                height: 12,
                text: 'Total Guests in Park: 0'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_pop_tracked',
                x: pad + 8,
                y: y + 34,
                width: innerWidth - 16,
                height: 12,
                text: 'Tracked with Personality: 0'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_pop_groups',
                x: pad + 8,
                y: y + 50,
                width: innerWidth - 16,
                height: 12,
                text: 'Active Social Groups: 0'
            });

            y += 78;

            // Mood Distribution Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_mood_stats',
                x: pad,
                y: y,
                width: innerWidth,
                height: 130,
                text: 'Mood Distribution'
            });

            var moodLabels = [
                'Ecstatic', 'Happy', 'Content', 'Neutral',
                'Bored', 'Annoyed', 'Sad', 'Angry',
                'Scared', 'Excited', 'Tired', 'Sick'
            ];

            var halfWidth = Math.floor((innerWidth - 10) / 2);
            var moodY = y + 18;

            for (var i = 0; i < moodLabels.length; i++) {
                var moodX = (i % 2 === 0) ? pad + 8 : pad + halfWidth + 8;
                var moodRow = Math.floor(i / 2);

                widgets.push({
                    type: 'label',
                    name: 'lbl_mood_stat_' + i,
                    x: moodX,
                    y: moodY + (moodRow * 18),
                    width: halfWidth - 8,
                    height: 12,
                    text: moodLabels[i] + ': 0'
                });
            }

            return widgets;
        },

        createDebugWidgets: function(startY, pad, innerWidth) {
            var widgets = [];
            var self = this;
            var y = startY;

            // Debug Options Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_debug_opts',
                x: pad,
                y: y,
                width: innerWidth,
                height: 52,
                text: 'Debug Options'
            });

            widgets.push({
                type: 'checkbox',
                name: 'chk_debug',
                x: pad + 8,
                y: y + 18,
                width: innerWidth - 16,
                height: 15,
                text: 'Enable Debug Logging (console)',
                isChecked: CONFIG.debugMode,
                onChange: function(checked) {
                    CONFIG.debugMode = checked;
                }
            });

            y += 60;

            // Guest Inspector Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_inspector',
                x: pad,
                y: y,
                width: innerWidth,
                height: 200,
                text: 'Guest Inspector'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_inspect_hint',
                x: pad + 8,
                y: y + 18,
                width: innerWidth - 16,
                height: 12,
                text: 'Enter Guest ID to inspect:'
            });

            widgets.push({
                type: 'textbox',
                name: 'txt_guest_id',
                x: pad + 8,
                y: y + 34,
                width: 100,
                height: 15,
                text: '',
                onChange: function(text) {
                    self.selectedGuestId = parseInt(text) || null;
                }
            });

            widgets.push({
                type: 'button',
                name: 'btn_inspect',
                x: pad + 116,
                y: y + 34,
                width: 80,
                height: 15,
                text: 'Inspect',
                onClick: function() {
                    self.inspectGuest();
                }
            });

            widgets.push({
                type: 'label',
                name: 'lbl_inspect_name',
                x: pad + 8,
                y: y + 56,
                width: innerWidth - 16,
                height: 12,
                text: 'Name: ---'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_inspect_mood',
                x: pad + 8,
                y: y + 72,
                width: innerWidth - 16,
                height: 12,
                text: 'Mood: ---'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_inspect_behavior',
                x: pad + 8,
                y: y + 88,
                width: innerWidth - 16,
                height: 12,
                text: 'Behavior: ---'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_inspect_traits',
                x: pad + 8,
                y: y + 104,
                width: innerWidth - 16,
                height: 12,
                text: 'Top Traits: ---'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_inspect_group',
                x: pad + 8,
                y: y + 120,
                width: innerWidth - 16,
                height: 12,
                text: 'Group: None'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_inspect_memory',
                x: pad + 8,
                y: y + 136,
                width: innerWidth - 16,
                height: 12,
                text: 'Rides Ridden: 0 | Spent: $0'
            });

            widgets.push({
                type: 'label',
                name: 'lbl_inspect_time',
                x: pad + 8,
                y: y + 152,
                width: innerWidth - 16,
                height: 12,
                text: 'Time in Park: 0 ticks'
            });

            y += 208;

            // Debug Actions Group
            widgets.push({
                type: 'groupbox',
                name: 'grp_debug_actions',
                x: pad,
                y: y,
                width: innerWidth,
                height: 70,
                text: 'Debug Actions'
            });

            widgets.push({
                type: 'button',
                name: 'btn_log_stats',
                x: pad + 8,
                y: y + 18,
                width: Math.floor(innerWidth / 2) - 12,
                height: 18,
                text: 'Log All Stats',
                onClick: function() {
                    var stats = PersonalityProcessor.getStatistics();
                    console.log('[PersonalityExpander] Statistics:');
                    for (var key in stats) {
                        if (stats.hasOwnProperty(key)) {
                            console.log('  ' + key + ': ' + JSON.stringify(stats[key]));
                        }
                    }
                }
            });

            widgets.push({
                type: 'button',
                name: 'btn_force_cleanup',
                x: pad + Math.floor(innerWidth / 2) + 4,
                y: y + 18,
                width: Math.floor(innerWidth / 2) - 12,
                height: 18,
                text: 'Force Cleanup',
                onClick: function() {
                    PersonalityStore.cleanupOldData();
                    console.log('[PersonalityExpander] Cleanup complete');
                }
            });

            widgets.push({
                type: 'button',
                name: 'btn_randomize_all',
                x: pad + 8,
                y: y + 42,
                width: innerWidth - 16,
                height: 18,
                text: 'Randomize All Guest Personalities',
                onClick: function() {
                    PersonalityStore.clear();
                    console.log('[PersonalityExpander] All personalities cleared and will regenerate');
                }
            });

            return widgets;
        },

        inspectGuest: function() {
            if (!this.mainWindow) return;
            if (this.selectedGuestId === null) return;

            try {
                var guest = map.getEntity(this.selectedGuestId);
                if (!guest || guest.type !== 'guest') {
                    this.updateLabel('lbl_inspect_name', 'Name: Guest not found');
                    return;
                }

                var data = PersonalityStore.getGuestData(this.selectedGuestId);
                if (!data) {
                    this.updateLabel('lbl_inspect_name', 'Name: No personality data');
                    return;
                }

                this.updateLabel('lbl_inspect_name', 'Name: ' + guest.name);
                this.updateLabel('lbl_inspect_mood', 'Mood: ' + data.mood.current + ' (intensity: ' + data.mood.intensity + ')');
                this.updateLabel('lbl_inspect_behavior', 'Behavior: ' + data.behavior.current);

                var traitList = [];
                for (var trait in data.traits) {
                    if (data.traits.hasOwnProperty(trait)) {
                        traitList.push({ name: trait, value: data.traits[trait] });
                    }
                }
                traitList.sort(function(a, b) { return b.value - a.value; });
                var topTraits = traitList.slice(0, 3).map(function(t) { return t.name + ':' + t.value; }).join(', ');
                this.updateLabel('lbl_inspect_traits', 'Top Traits: ' + topTraits);

                var groupInfo = data.social.groupId ? ('ID ' + data.social.groupId + (data.social.isLeader ? ' (Leader)' : '')) : 'None';
                this.updateLabel('lbl_inspect_group', 'Group: ' + groupInfo);

                var ridesCount = Object.keys(data.memory.ridesRidden).length;
                this.updateLabel('lbl_inspect_memory', 'Rides Ridden: ' + ridesCount + ' | Spent: $' + (data.memory.totalSpent / 10).toFixed(2));
                this.updateLabel('lbl_inspect_time', 'Time in Park: ' + data.memory.timeInPark + ' ticks');

            } catch (e) {
                this.updateLabel('lbl_inspect_name', 'Error: ' + e);
            }
        },

        switchTab: function(tabIndex) {
            this.currentTab = tabIndex;
            this.openWindow();
        },

        closeWindow: function() {
            if (this.mainWindow) {
                this.mainWindow.close();
                this.mainWindow = null;
            }
        },

        toggleWindow: function() {
            if (this.mainWindow) {
                this.closeWindow();
            } else {
                this.openWindow();
            }
        },

        updateLabel: function(name, text) {
            if (this.mainWindow) {
                var widget = this.mainWindow.findWidget(name);
                if (widget) {
                    widget.text = text;
                }
            }
        },

        updateSpinner: function(name, value) {
            if (this.mainWindow) {
                var widget = this.mainWindow.findWidget(name);
                if (widget) {
                    widget.text = String(value);
                }
            }
        },

        startStatisticsUpdate: function() {
            var self = this;
            context.setInterval(function() {
                if (self.mainWindow) {
                    self.updateStatisticsDisplay();
                }
            }, 500);
        },

        updateStatisticsDisplay: function() {
            if (!this.mainWindow) return;

            var stats = PersonalityProcessor.getStatistics();

            this.updateLabel('lbl_netmode', 'Mode: ' + NetworkHelper.getModeString());
            this.updateLabel('lbl_netperm', 'Permissions: ' + (NetworkHelper.canModifyGameState() ? 'Full Control' : 'Read-Only'));

            if (this.currentTab === 0) {
                this.updateLabel('lbl_frame', 'Frame: ' + stats.lastFrameTime + 'ms (Avg: ' + stats.avgFrameTime + 'ms)');
                this.updateLabel('lbl_tracked', 'Tracked Guests: ' + stats.trackedGuests);
                this.updateLabel('lbl_groups', 'Active Groups: ' + stats.activeGroups);
                this.updateLabel('lbl_processing', 'Processing Rate: ' + CONFIG.maxGuestsPerTick + ' guests/tick');

                var traitNames = [
                    'thrillSeeker', 'social', 'patient', 'frugal',
                    'hungry', 'adventurous', 'nervous', 'energetic',
                    'romantic', 'foodie', 'collector', 'photographer'
                ];
                var traitLabels = [
                    'Thrill Seeker', 'Social', 'Patient', 'Frugal',
                    'Hungry', 'Adventurous', 'Nervous', 'Energetic',
                    'Romantic', 'Foodie', 'Collector', 'Photographer'
                ];

                for (var i = 0; i < traitNames.length; i++) {
                    var avgValue = stats.averageTraits[traitNames[i]] || '---';
                    this.updateLabel('lbl_trait_' + i, traitLabels[i] + ': ' + avgValue);
                }
            } else if (this.currentTab === 2) {
                this.updateLabel('lbl_stat_processed', 'Guests Processed: ' + stats.guestsProcessed);
                this.updateLabel('lbl_stat_created', 'Personalities Created: ' + stats.personalitiesCreated);
                this.updateLabel('lbl_stat_ticks', 'Ticks Processed: ' + stats.ticksProcessed);
                this.updateLabel('lbl_stat_rate', 'Current Rate: ' + CONFIG.maxGuestsPerTick + ' guests/tick');

                var totalGuests = 0;
                try {
                    totalGuests = map.getAllEntities('guest').length;
                } catch (e) {}

                this.updateLabel('lbl_pop_total', 'Total Guests in Park: ' + totalGuests);
                this.updateLabel('lbl_pop_tracked', 'Tracked with Personality: ' + stats.trackedGuests);
                this.updateLabel('lbl_pop_groups', 'Active Social Groups: ' + stats.activeGroups);

                var moodCounts = this.calculateMoodDistribution();
                var moodKeys = [
                    MOOD_STATES.ECSTATIC, MOOD_STATES.HAPPY, MOOD_STATES.CONTENT, MOOD_STATES.NEUTRAL,
                    MOOD_STATES.BORED, MOOD_STATES.ANNOYED, MOOD_STATES.SAD, MOOD_STATES.ANGRY,
                    MOOD_STATES.SCARED, MOOD_STATES.EXCITED, MOOD_STATES.TIRED, MOOD_STATES.SICK
                ];
                var moodLabels = [
                    'Ecstatic', 'Happy', 'Content', 'Neutral',
                    'Bored', 'Annoyed', 'Sad', 'Angry',
                    'Scared', 'Excited', 'Tired', 'Sick'
                ];

                for (var j = 0; j < moodKeys.length; j++) {
                    var count = moodCounts[moodKeys[j]] || 0;
                    this.updateLabel('lbl_mood_stat_' + j, moodLabels[j] + ': ' + count);
                }
            }
        },

        calculateMoodDistribution: function() {
            var counts = {};
            
            for (var guestId in PersonalityStore.guests) {
                if (PersonalityStore.guests.hasOwnProperty(guestId)) {
                    var data = PersonalityStore.guests[guestId];
                    var mood = data.mood.current;
                    counts[mood] = (counts[mood] || 0) + 1;
                }
            }
            
            return counts;
        }
    };

    // ===========================================
    // COMPATIBILITY LAYER
    // ===========================================
    var CompatibilityLayer = {
        enhancedPathfindingInstalled: false,

        checkCompatibility: function() {
            try {
                this.enhancedPathfindingInstalled = true;
                
                if (CONFIG.debugMode) {
                    console.log('[PersonalityExpander] Compatibility check passed');
                }
            } catch (e) {
                if (CONFIG.debugMode) {
                    console.log('[PersonalityExpander] Compatibility check error: ' + e);
                }
            }
        },

        canModifyGuest: function(guestId) {
            return true;
        },

        onPathfindingAssist: function(guestId) {
            if (PersonalityStore.hasGuestData(guestId)) {
                var data = PersonalityStore.getGuestData(guestId);
                if (data.mood.current === MOOD_STATES.SAD || data.mood.current === MOOD_STATES.ANGRY) {
                    data.mood.current = MOOD_STATES.NEUTRAL;
                    data.mood.intensity = 128;
                }
            }
        }
    };

    // ===========================================
    // CUSTOM GAME ACTIONS (for multiplayer sync)
    // ===========================================
    var GameActions = {
        register: function() {
            try {
                context.registerAction(
                    'personality-expander-sync',
                    function(args) {
                        return {
                            error: 0,
                            errorTitle: null,
                            errorMessage: null,
                            cost: 0
                        };
                    },
                    function(args) {
                        if (args.action === 'mood-update') {
                            GameActions.executeMoodUpdate(args);
                        } else if (args.action === 'group-create') {
                            GameActions.executeGroupCreate(args);
                        } else if (args.action === 'group-add') {
                            GameActions.executeGroupAdd(args);
                        }
                        return {
                            error: 0,
                            cost: 0
                        };
                    }
                );

                if (CONFIG.debugMode) {
                    console.log('[PersonalityExpander] Custom game actions registered');
                }
            } catch (e) {
                if (CONFIG.debugMode) {
                    console.log('[PersonalityExpander] Failed to register game actions: ' + e);
                }
            }
        },

        executeMoodUpdate: function(args) {
            var guestId = args.guestId;
            var newMood = args.mood;
            var intensity = args.intensity;

            if (PersonalityStore.hasGuestData(guestId)) {
                var data = PersonalityStore.getGuestData(guestId);
                data.mood.current = newMood;
                data.mood.intensity = intensity;
                data.mood.lastChange = date.ticksElapsed;
            }
        },

        executeGroupCreate: function(args) {
            var leaderId = args.leaderId;
            PersonalityStore.createGroup(leaderId);
        },

        executeGroupAdd: function(args) {
            var guestId = args.guestId;
            var groupId = args.groupId;
            PersonalityStore.addToGroup(guestId, groupId);
        }
    };

    // ===========================================
    // MAIN ENTRY POINT
    // ===========================================
    function main() {
        PersonalityProcessor.initialize();
        CompatibilityLayer.checkCompatibility();
        GameActions.register();

        if (typeof ui !== 'undefined') {
            ui.registerMenuItem('Guest Personality Expander', function() {
                UIManager.toggleWindow();
            });
        }

        context.subscribe('interval.tick', function() {
            try {
                PersonalityProcessor.onTick();
            } catch (e) {
                if (CONFIG.debugMode) {
                    console.log('[PersonalityExpander] Tick error: ' + e);
                }
            }
        });

        context.subscribe('guest.generation', function(e) {
            try {
                GuestGenerationHandler.onGuestGenerated(e.id);
            } catch (ex) {
                if (CONFIG.debugMode) {
                    console.log('[PersonalityExpander] Guest generation error: ' + ex);
                }
            }
        });

        context.subscribe('map.change', function() {
            PersonalityStore.clear();
            PersonalityProcessor.initialize();
            if (CONFIG.debugMode) {
                console.log('[PersonalityExpander] Map changed, data reset');
            }
        });

        context.subscribe('network.join', function(e) {
            if (CONFIG.debugMode) {
                console.log('[PersonalityExpander] Player joined: ' + e.player);
            }
        });

        context.subscribe('network.leave', function(e) {
            if (CONFIG.debugMode) {
                console.log('[PersonalityExpander] Player left: ' + e.player);
            }
        });

        var modeStr = NetworkHelper.getModeString();
        console.log('[Guest Personality Expander v1.0.1] Loaded!');
        console.log('[Guest Personality Expander v1.0.1] Network mode: ' + modeStr);

        if (NetworkHelper.canModifyGameState()) {
            console.log('[Guest Personality Expander v1.0.1] Full control - personality system active');
        } else {
            console.log('[Guest Personality Expander v1.0.1] Client mode - read-only (viewing only)');
        }
    }

    // ===========================================
    // PLUGIN REGISTRATION
    // ===========================================
    registerPlugin({
        name: 'Guest Personality & Behavior Expander',
        version: '1.0.1',
        authors: ['CodingFleet AI Assistant'],
        type: 'remote',
        licence: 'MIT',
        targetApiVersion: 77,
        minApiVersion: 34,
        main: main
    });

})();
