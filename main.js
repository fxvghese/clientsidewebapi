const $ = sel => document.querySelector(sel);
const form = $('#search-form');
const cityInput = $('#city-input');
const locBtn = $('#loc-btn');
const unitsSelect = $('#units-select');
const result = $('#result');
const favList = $('#favorites-list');

const STORAGE_KEY = 'weatherApp.preferences';

function loadPrefs(){
  try{
    const s = localStorage.getItem(STORAGE_KEY);
    const p = s?JSON.parse(s):{units:'metric',favorites:[],lastCity:null};
    // normalize favorites to objects {name, latitude?, longitude?}
    p.favorites = (p.favorites||[]).map(f => typeof f === 'string' ? {name:f} : f);
    return p;
  }catch(e){
    return {units:'metric',favorites:[],lastCity:null};
  }
}
function savePrefs(p){localStorage.setItem(STORAGE_KEY,JSON.stringify(p))}

let prefs = loadPrefs();
unitsSelect.value = prefs.units || 'metric';

function showMessage(html){result.classList.remove('empty');result.innerHTML = html}

function weatherCodeToDescription(code){
  if (code === 0) return 'Clear sky';
  if (code === 1 || code === 2 || code === 3) return 'Mainly clear/partly cloudy/overcast';
  if (code === 45 || code === 48) return 'Fog';
  if ([51,53,55].includes(code)) return 'Drizzle';
  if ([56,57].includes(code)) return 'Freezing drizzle';
  if ([61,63,65].includes(code)) return 'Rain';
  if ([66,67].includes(code)) return 'Freezing rain';
  if ([71,73,75].includes(code)) return 'Snow';
  if (code === 77) return 'Snow grains';
  if ([80,81,82].includes(code)) return 'Rain showers';
  if ([85,86].includes(code)) return 'Snow showers';
  if (code === 95) return 'Thunderstorm';
  if (code === 96 || code === 99) return 'Thunderstorm with hail';
  return 'Weather';
}

function displayWeather(locationName, country, weather){
  const units = unitsSelect.value === 'imperial' ? 'imperial' : 'metric';
  const tUnit = units === 'metric' ? '°C' : '°F';
  const desc = weatherCodeToDescription(weather.weathercode);
  const html = `
    <div class="weather-row">
      <div>
        <div class="weather-temp">${Math.round(weather.temperature)}${tUnit}</div>
        <div class="weather-desc">${desc} · ${locationName || ''}${country? ', '+country:''}</div>
        <button id="save-fav">Save to favorites</button>
      </div>
      <div class="meta">Wind ${Math.round(weather.windspeed)} ${units==='metric'? 'km/h':'mph'}</div>
    </div>
  `;
  showMessage(html);
  $('#save-fav').addEventListener('click', ()=>{
    addFavorite({name: locationName, latitude: weather.latitude, longitude: weather.longitude});
  });
}

function renderFavorites(){
  favList.innerHTML = '';
  prefs.favorites.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item.name;
    li.addEventListener('click', ()=>{
      if (item.latitude && item.longitude) fetchWeatherByCoords(item.latitude, item.longitude, item.name, item.country);
      else fetchWeatherByCity(item.name);
    });
    favList.appendChild(li);
  });
}

function addFavorite(cityObj){
  if (!prefs.favorites.find(f => f.name === cityObj.name)){
    prefs.favorites.push(cityObj);
    savePrefs(prefs);
    renderFavorites();
  }
}

async function geocodeCity(city){
  try{
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    if (!data.results || data.results.length === 0) throw new Error('City not found');
    return data.results[0];
  }catch(err){
    throw err;
  }
}

async function fetchWeatherByCity(city){
  try{
    showMessage('<p>Searching…</p>');
    const loc = await geocodeCity(city);
    fetchWeatherByCoords(loc.latitude, loc.longitude, loc.name, loc.country);
  }catch(err){
    showMessage(`<p class="error">${err.message}</p>`);
  }
}

async function fetchWeatherByCoords(lat, lon, displayName, country){
  try{
    showMessage('<p>Loading…</p>');
    const units = unitsSelect.value === 'imperial' ? 'fahrenheit' : 'celsius';
    const windUnit = unitsSelect.value === 'imperial' ? 'mph' : 'kmh';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=${units}&windspeed_unit=${windUnit}&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();
    const cw = data.current_weather;
    // attach coords so saveFavorite can include them
    cw.latitude = lat; cw.longitude = lon;
    prefs.lastCity = displayName || (prefs.lastCity || '');
    savePrefs(prefs);
    displayWeather(displayName || '', country || '', cw);
  }catch(err){
    showMessage(`<p class="error">Error fetching weather: ${err.message}</p>`);
  }
}

form.addEventListener('submit', e =>{
  e.preventDefault();
  const city = cityInput.value.trim();
  if (city) fetchWeatherByCity(city);
});

locBtn.addEventListener('click', ()=>{
  if (!navigator.geolocation){
    showMessage('<p>Your browser does not support Geolocation.</p>');
    return;
  }
  showMessage('<p>Getting your location…</p>');
  navigator.geolocation.getCurrentPosition(pos =>{
    fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude, 'Your location');
  }, err =>{
    showMessage(`<p class="error">Geolocation error: ${err.message}</p>`);
  });
});

unitsSelect.addEventListener('change', ()=>{
  prefs.units = unitsSelect.value;
  savePrefs(prefs);
  if (prefs.lastCity) fetchWeatherByCity(prefs.lastCity);
});

renderFavorites();
if (prefs.lastCity) fetchWeatherByCity(prefs.lastCity);
