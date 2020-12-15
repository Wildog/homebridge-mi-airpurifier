require('./Base');

const inherits = require('util').inherits;
const miio = require('miio');

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;

MiAirPurifierMAX = function(platform, config) {
    this.init(platform, config);
    
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
    
    this.device = new miio.Device({
        address: this.config['ip'],
        token: this.config['token']
    });

    this.accessories = {};
    if(!this.config['airPurifierDisable'] && this.config['airPurifierName'] && this.config['airPurifierName'] != "" && this.config['silentModeSwitchName'] && this.config['silentModeSwitchName'] != "") {
        this.accessories['airPurifierAccessory'] = new MiAirPurifierMAXAirPurifierAccessory(this);
    }
    if(!this.config['temperatureDisable'] && this.config['temperatureName'] && this.config['temperatureName'] != "") {
        this.accessories['temperatureAccessory'] = new MiAirPurifierMAXTemperatureAccessory(this);
    }
    if(!this.config['humidityDisable'] && this.config['humidityName'] && this.config['humidityName'] != "") {
        this.accessories['humidityAccessory'] = new MiAirPurifierMAXHumidityAccessory(this);
    }
    if(!this.config['buzzerSwitchDisable'] && this.config['buzzerSwitchName'] && this.config['buzzerSwitchName'] != "") {
        this.accessories['buzzerSwitchAccessory'] = new MiAirPurifierMAXBuzzerSwitchAccessory(this);
    }
    if(!this.config['ledBulbDisable'] && this.config['ledBulbName'] && this.config['ledBulbName'] != "") {
        this.accessories['ledBulbAccessory'] = new MiAirPurifierMAXLEDBulbAccessory(this);
    }
    if(!this.config['airQualityDisable'] && this.config['airQualityName'] && this.config['airQualityName'] != "") {
        this.accessories['airQualityAccessory'] = new MiAirPurifierMAXAirQualityAccessory(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[MiAirPurifierPlatform][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    return accessoriesArr;
}
inherits(MiAirPurifierMAX, Base);

MiAirPurifierMAXAirPurifierAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['airPurifierName'];
    this.silentModeSwitchDisable = dThis.config['silentModeSwitchDisable'];
    this.silentModeSwitchName = dThis.config['silentModeSwitchName'];
    this.platform = dThis.platform;
    this.frm = [0,10,25,40,50,60,70,85,100];
}

MiAirPurifierMAXAirPurifierAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifierMAX")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);

    var silentModeSwitch = new Service.Switch(this.silentModeSwitchName);
    var silentModeOnCharacteristic = silentModeSwitch.getCharacteristic(Characteristic.On);
    if(!this.silentModeSwitchDisable) {
        services.push(silentModeSwitch);
    }
    
    var airPurifierService = new Service.AirPurifier(this.name);
    var activeCharacteristic = airPurifierService.getCharacteristic(Characteristic.Active);
    var currentAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.CurrentAirPurifierState);
    var targetAirPurifierStateCharacteristic = airPurifierService.getCharacteristic(Characteristic.TargetAirPurifierState);
    var lockPhysicalControlsCharacteristic = airPurifierService.addCharacteristic(Characteristic.LockPhysicalControls);
    var rotationSpeedCharacteristic = airPurifierService.addCharacteristic(Characteristic.RotationSpeed);
    
    var currentTemperatureCharacteristic = airPurifierService.addCharacteristic(Characteristic.CurrentTemperature);
    var currentRelativeHumidityCharacteristic = airPurifierService.addCharacteristic(Characteristic.CurrentRelativeHumidity);
    var pm25DensityCharacteristic = airPurifierService.addCharacteristic(Characteristic.PM2_5Density);
    var airQualityCharacteristic = airPurifierService.addCharacteristic(Characteristic.AirQuality);
    services.push(airPurifierService);
    
    silentModeOnCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - SilentModeSwitch - getOn: " + result);
                
                if(result[0] === "silent") {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - SilentModeSwitch - getOn Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - SilentModeSwitch - setOn: " + value);
            if(value) {
                that.device.call("set_mode", ["silent"]).then(result => {
                    that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - SilentModeSwitch - setOn Result: " + result);
                    if(result[0] === "ok") {
                        targetAirPurifierStateCharacteristic.updateValue(Characteristic.TargetAirPurifierState.AUTO);
                        callback(null);
                        
                        if(Characteristic.Active.INACTIVE == activeCharacteristic.value) {
                            activeCharacteristic.updateValue(Characteristic.Active.ACTIVE);
                            currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                        }
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - SilentModeSwitch - setOn Error: " + err);
                    callback(err);
                });
            } else {
                if(Characteristic.Active.INACTIVE == activeCharacteristic.value) {
                    callback(null);
                } else {
                    that.device.call("set_mode", [Characteristic.TargetAirPurifierState.AUTO == targetAirPurifierStateCharacteristic.value ? "auto" : "favorite"]).then(result => {
                        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - SilentModeSwitch - setOn Result: " + result);
                        if(result[0] === "ok") {
                            callback(null);
                        } else {
                            callback(new Error(result[0]));
                        }
                    }).catch(function(err) {
                        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - SilentModeSwitch - setOn Error: " + err);
                        callback(err);
                    });
                }
            }
        }.bind(this));
    
    activeCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["power"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - Active - getActive: " + result);
                
                if(result[0] === "off") {
                    callback(null, Characteristic.Active.INACTIVE);
                } else {
                    callback(null, Characteristic.Active.ACTIVE);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - Active - getActive Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - Active - setActive: " + value);
            that.device.call("set_power", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - Active - setActive Result: " + result);
                if(result[0] === "ok") {
                    currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.IDLE);
                    callback(null);
                    if(value) {
                        currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                        that.device.call("get_prop", ["mode"]).then(result => {
                            if(result[0] === "silent") {
                                silentModeOnCharacteristic.updateValue(true);
                            } else {
                                silentModeOnCharacteristic.updateValue(false);
                            }
                        }).catch(function(err) {
                            that.platform.log.error("[MiAirPurifierPlatform][ERROR]AirPurifier2AirPurifierAccessory - Active - setActive Error: " + err);
                            callback(err);
                        });
                    } else {
                        currentAirPurifierStateCharacteristic.updateValue(Characteristic.CurrentAirPurifierState.INACTIVE);
                        silentModeOnCharacteristic.updateValue(false);
                    }
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - Active - setActive Error: " + err);
                callback(err);
            });
        }.bind(this));
       
    currentAirPurifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["power"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - CurrentAirPurifierState - getCurrentAirPurifierState: " + result);
                
                if(result[0] === "off") {
                    callback(null, Characteristic.CurrentAirPurifierState.INACTIVE);
                } else {
                    callback(null, Characteristic.CurrentAirPurifierState.PURIFYING_AIR);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - CurrentAirPurifierState - getCurrentAirPurifierState Error: " + err);
                callback(err);
            });
        }.bind(this));

    lockPhysicalControlsCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["child_lock"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - LockPhysicalControls - getLockPhysicalControls: " + result);
                callback(null, result[0] === "on" ? Characteristic.LockPhysicalControls.CONTROL_LOCK_ENABLED : Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - LockPhysicalControls - getLockPhysicalControls Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.device.call("set_child_lock", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - LockPhysicalControls - setLockPhysicalControls Result: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - LockPhysicalControls - setLockPhysicalControls Error: " + err);
                callback(err);
            });
        }.bind(this));
        
    targetAirPurifierStateCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["mode"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - TargetAirPurifierState - getTargetAirPurifierState: " + result);
                
                if(result[0] === "favorite") {
                    callback(null, Characteristic.TargetAirPurifierState.MANUAL);
                } else {
                    callback(null, Characteristic.TargetAirPurifierState.AUTO);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - TargetAirPurifierState - getTargetAirPurifierState: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState: " + value);
            that.device.call("set_mode", [Characteristic.TargetAirPurifierState.AUTO == value ? (silentModeOnCharacteristic.value ? "silent" : "auto") : "favorite"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState Result: " + result);
                if(result[0] === "ok") {
                    if(Characteristic.TargetAirPurifierState.AUTO == value) {
                        callback(null);
                    } else {
                        that.device.call("get_prop", ["favorite_level"]).then(result => {
                            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + result);
                            silentModeOnCharacteristic.updateValue(false);
                            if(rotationSpeedCharacteristic.value <= result[0] * 10 && rotationSpeedCharacteristic.value > (result[0] - 1) * 10) {
                                callback(null);
                            } else {
                                rotationSpeedCharacteristic.value = result[0] * 10;
                                callback(null);
                            }
                        }).catch(function(err) {
                            that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + err);
                            callback(err);
                        });
                    }
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - TargetAirPurifierState - setTargetAirPurifierState Error: " + err);
                callback(err);
            });
        }.bind(this));
    
    rotationSpeedCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["favorite_level"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - RotationSpeed - getRotationSpeed: " + result);
                callback(null, that.getRotationSpeedByFavoriteLevel(parseInt(result[0]), rotationSpeedCharacteristic.value));
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - RotationSpeed - getRotationSpeed Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - RotationSpeed - setRotationSpeed set: " + value);
            if(value == 0) {
                callback(null);
            } else {
                that.device.call("set_level_favorite", [that.getFavoriteLevelByRotationSpeed(value)]).then(result => {
                    that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - RotationSpeed - setRotationSpeed Result: " + result);
                    if(result[0] === "ok") {
//                      that.device.call("set_mode", ["favorite"]).then(result => {
//                          that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirPurifierAccessory - RotationSpeed - setTargetAirPurifierState Result: " + result);
//                          if(result[0] === "ok") {
//                              targetAirPurifierStateCharacteristic.updateValue(Characteristic.TargetAirPurifierState.MANUAL);
//                              silentModeOnCharacteristic.updateValue(false);
                                callback(null);
//                          } else {
//                              callback(new Error(result[0]));
//                          }
//                      }).catch(function(err) {
//                          that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - RotationSpeed - setTargetAirPurifierState Error: " + err);
//                          callback(err);
//                      });
                    } else {
                        callback(new Error(result[0]));
                    }
                }).catch(function(err) {
                    that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirPurifierAccessory - TargetAirPurifierState - getRotationSpeed: " + err);
                    callback(err);
                })
            }
        }.bind(this));

    currentTemperatureCharacteristic.on('get', function(callback) {
        this.device.call("get_prop", ["temp_dec"]).then(result => {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - Temperature - getTemperature: " + result);
            callback(null, result[0] / 10);
        }).catch(function(err) {
            that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - Temperature - getTemperature Error: " + err);
            callback(err);
        });
    }.bind(this));

    currentRelativeHumidityCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["humidity"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - Humidity - getHumidity: " + result);
                callback(null, result[0]);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - Humidity - getHumidity Error: " + err);
                callback(err);
            });
        }.bind(this));

    pm25DensityCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["aqi"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - aqi - getHumidity: " + result);
                callback(null, result[0]);
                
                var airQualityValue = Characteristic.AirQuality.UNKNOWN;
                if(result[0] <= 15) {
                    airQualityValue = Characteristic.AirQuality.EXCELLENT;
                } else if(result[0] > 15 && result[0] <= 30) {
                    airQualityValue = Characteristic.AirQuality.GOOD;
                } else if(result[0] > 30 && result[0] <= 60) {
                    airQualityValue = Characteristic.AirQuality.FAIR;
                } else if(result[0] > 60 && result[0] <= 150) {
                    airQualityValue = Characteristic.AirQuality.INFERIOR;
                } else if(result[0] > 150) {
                    airQualityValue = Characteristic.AirQuality.POOR;
                } else {
                    airQualityValue = Characteristic.AirQuality.UNKNOWN;
                }
                airQualityCharacteristic.updateValue(airQualityValue);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - aqi - getHumidity Error: " + err);
                callback(err);
            });
        }.bind(this));

    // var filterMaintenanceService = new Service.FilterMaintenance(this.name);
    var filterChangeIndicationCharacteristic = airPurifierService.getCharacteristic(Characteristic.FilterChangeIndication);
    var filterLifeLevelCharacteristic = airPurifierService.addCharacteristic(Characteristic.FilterLifeLevel);

    filterChangeIndicationCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["filter1_life", "filter2_life"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - FilterChangeIndication - getFilterChangeIndication: " + result);
                callback(null, Math.min(result[0], result[1]) < 5 ? Characteristic.FilterChangeIndication.CHANGE_FILTER : Characteristic.FilterChangeIndication.FILTER_OK);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - FilterChangeIndication - getFilterChangeIndication Error: " + err);
                callback(err);
            });
        }.bind(this));
    filterLifeLevelCharacteristic
        .on('get', function(callback) {
            that.device.call("get_prop", ["filter1_life", "filter2_life"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifier2AirPurifierAccessory - FilterLifeLevel - getFilterLifeLevel: " + result);
                callback(null, Math.min(result[0], result[1]));
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifier2AirPurifierAccessory - FilterLifeLevel - getFilterLifeLevel Error: " + err);
                callback(err);
            });
        }.bind(this));
    // services.push(filterMaintenanceService);

    return services;
}

MiAirPurifierMAXAirPurifierAccessory.prototype.getFavoriteLevelByRotationSpeed = function(rotationSpeed) {
    if(this.frm.length < 2) {
        return 1;
    }
    
    for(var i = 1; i< this.frm.length; i++) {
        if(rotationSpeed > this.frm[i-1] && rotationSpeed <= this.frm[i]) {
            return i;
        }
    }
    
    return 1;
}

MiAirPurifierMAXAirPurifierAccessory.prototype.getRotationSpeedByFavoriteLevel = function(favoriteLevel, rotationSpeed) {
    if(this.frm.length < 2) {
        return 1;
    }
    
    if(rotationSpeed > this.frm[favoriteLevel-1] && rotationSpeed <= this.frm[favoriteLevel]) {
        return rotationSpeed;
    } else {
        return this.frm[favoriteLevel];
    }

}

MiAirPurifierMAXTemperatureAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['temperatureName'];
    this.platform = dThis.platform;
}

MiAirPurifierMAXTemperatureAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifierMAX")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var temperatureService = new Service.TemperatureSensor(this.name);
    temperatureService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getTemperature.bind(this))
    services.push(temperatureService);
    
    return services;
}

MiAirPurifierMAXTemperatureAccessory.prototype.getTemperature = function(callback) {
    var that = this;
    this.device.call("get_prop", ["temp_dec"]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXTemperatureAccessory - Temperature - getTemperature: " + result);
        callback(null, result[0] / 10);
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXTemperatureAccessory - Temperature - getTemperature Error: " + err);
        callback(err);
    });
}

MiAirPurifierMAXHumidityAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['humidityName'];
    this.platform = dThis.platform;
}

MiAirPurifierMAXHumidityAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifierMAX")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var humidityService = new Service.HumiditySensor(this.name);
    humidityService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('get', this.getHumidity.bind(this))
    services.push(humidityService);

    return services;
}

MiAirPurifierMAXHumidityAccessory.prototype.getHumidity = function(callback) {
    var that = this;
    this.device.call("get_prop", ["humidity"]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXHumidityAccessory - Humidity - getHumidity: " + result);
        callback(null, result[0]);
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXHumidityAccessory - Humidity - getHumidity Error: " + err);
        callback(err);
    });
}

MiAirPurifierMAXBuzzerSwitchAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['buzzerSwitchName'];
    this.platform = dThis.platform;
}

MiAirPurifierMAXBuzzerSwitchAccessory.prototype.getServices = function() {
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifier2")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var switchService = new Service.Switch(this.name);
    switchService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getBuzzerState.bind(this))
        .on('set', this.setBuzzerState.bind(this));
    services.push(switchService);

    return services;
}

MiAirPurifierMAXBuzzerSwitchAccessory.prototype.getBuzzerState = function(callback) {
    var that = this;
    this.device.call("get_prop", ["volume"]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXBuzzerSwitchAccessory - Mute - getBuzzerState: " + result);
        callback(null, result[0] === "on" ? true : false);
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXBuzzerSwitchAccessory - Mute - getBuzzerState Error: " + err);
        callback(err);
    });
}

MiAirPurifierMAXBuzzerSwitchAccessory.prototype.setBuzzerState = function(value, callback) {
    var that = this;
    that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXBuzzerSwitchAccessory - Mute - setBuzzerState: " + value);
    that.device.call("set_buzzer", [value ? "on" : "off"]).then(result => {
        that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXBuzzerSwitchAccessory - Mute - setBuzzerState Result: " + result);
        if(result[0] === "ok") {
            callback(null);
        } else {
            callback(new Error(result[0]));
        }
    }).catch(function(err) {
        that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXBuzzerSwitchAccessory - Mute - setBuzzerState Error: " + err);
        callback(err);
    });
}

MiAirPurifierMAXLEDBulbAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['ledBulbName'];
    this.platform = dThis.platform;
}

MiAirPurifierMAXLEDBulbAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];

    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifierMAX")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var switchLEDService = new Service.Lightbulb(this.name);
    var onCharacteristic = switchLEDService.getCharacteristic(Characteristic.On);
    
    onCharacteristic
        .on('get', function(callback) {
            this.device.call("get_prop", ["led"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXLEDBulbAccessory - switchLED - getLEDPower: " + result);
                callback(null, result[0] === "on" ? true : false);
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXLEDBulbAccessory - switchLED - getLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('set', function(value, callback) {
            that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXLEDBulbAccessory - switchLED - setLEDPower: " + value + ", nowValue: " + onCharacteristic.value);
            this.device.call("set_led", [value ? "on" : "off"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXLEDBulbAccessory - switchLED - setLEDPower Result: " + result);
                if(result[0] === "ok") {
                    callback(null);
                } else {
                    callback(new Error(result[0]));
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXLEDBulbAccessory - switchLED - setLEDPower Error: " + err);
                callback(err);
            });
        }.bind(this));
    services.push(switchLEDService);

    return services;
}

MiAirPurifierMAXAirQualityAccessory = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['airQualityName'];
    this.platform = dThis.platform;
}

MiAirPurifierMAXAirQualityAccessory.prototype.getServices = function() {
    var that = this;
    var services = [];
    
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "AirPurifierMAX")
        .setCharacteristic(Characteristic.SerialNumber, "Undefined");
    services.push(infoService);
    
    var pmService = new Service.AirQualitySensor(this.name);
    var pm2_5Characteristic = pmService.addCharacteristic(Characteristic.PM2_5Density);
    pmService
        .getCharacteristic(Characteristic.AirQuality)
        .on('get', function(callback) {
            that.device.call("get_prop", ["aqi"]).then(result => {
                that.platform.log.debug("[MiAirPurifierPlatform][DEBUG]MiAirPurifierMAXAirQualityAccessory - AirQuality - getAirQuality: " + result);
                
                pm2_5Characteristic.updateValue(result[0]);
                
                if(result[0] <= 15) {
                    callback(null, Characteristic.AirQuality.EXCELLENT);
                } else if(result[0] > 15 && result[0] <= 30) {
                    callback(null, Characteristic.AirQuality.GOOD);
                } else if(result[0] > 30 && result[0] <= 60) {
                    callback(null, Characteristic.AirQuality.FAIR);
                } else if(result[0] > 60 && result[0] <= 150) {
                    callback(null, Characteristic.AirQuality.INFERIOR);
                } else if(result[0] > 150) {
                    callback(null, Characteristic.AirQuality.POOR);
                } else {
                    callback(null, Characteristic.AirQuality.UNKNOWN);
                }
            }).catch(function(err) {
                that.platform.log.error("[MiAirPurifierPlatform][ERROR]MiAirPurifierMAXAirQualityAccessory - AirQuality - getAirQuality Error: " + err);
                callback(err);
            });
        }.bind(this));
    services.push(pmService);

    return services;
}
