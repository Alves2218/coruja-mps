const STORAGE_KEY = 'person-map-locations-v1';

const form = document.getElementById('person-form');
const nameInput = document.getElementById('person-name');
const noteInput = document.getElementById('person-note');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('people-list');
const addressInput = document.getElementById('address-input');
const searchBtn = document.getElementById('search-address-btn');
const searchStatusEl = document.getElementById('search-status');
const personAddressInput = document.getElementById('person-address');
const useAddressBtn = document.getElementById('use-address-btn');
const personImageInput = document.getElementById('person-image');
const personCpfInput = document.getElementById('person-cpf');
const personBirthdateInput = document.getElementById('person-birthdate');
const csvInput = document.getElementById('csv-input');
const importCsvBtn = document.getElementById('import-csv-btn');
const csvStatusEl = document.getElementById('csv-status');

let selectedLatLng = null;
let editingId = null;
let people = loadPeople();

const map = L.map('map').setView([-15.7801, -47.9292], 5);
const markersLayer = L.layerGroup().addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

function loadPeople() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (error) {
    console.error('Erro ao ler localStorage:', error);
    return [];
  }
}

function savePeople() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
}

function normalizeCsvHeader(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseCsv(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      lines.push(current.trim());
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (current.trim() !== '' || lines.length > 0) {
        lines.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.trim() !== '' || lines.length > 0) {
    lines.push(current.trim());
  }

  const rows = lines.filter(Boolean);
  if (rows.length < 2) return [];

  const headers = rows[0].split(',').map((item) => normalizeCsvHeader(item));

  return rows.slice(1).map((line) => {
    const values = [];
    let currentValue = '';
    let inValueQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inValueQuotes && next === '"') {
          currentValue += '"';
          i += 1;
        } else {
          inValueQuotes = !inValueQuotes;
        }
      } else if (char === ',' && !inValueQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue.trim());

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

async function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderPeople() {
  listEl.innerHTML = '';
  markersLayer.clearLayers();

  if (!people.length) {
    listEl.innerHTML = '<li>Nenhuma pessoa salva ainda.</li>';
    return;
  }

  people.forEach((person, index) => {
    const item = document.createElement('li');
    item.innerHTML = `
      <div class="name">${person.name}</div>
      <div class="meta">${person.note || 'Sem observação'}</div>
      ${person.cpf ? `<div class="meta">CPF: ${person.cpf}</div>` : ''}
      ${person.birthdate ? `<div class="meta">Nascimento: ${formatDate(person.birthdate)}</div>` : ''}
      ${person.phone ? `<div class="meta">Telefone: ${person.phone}</div>` : ''}
      ${person.city ? `<div class="meta">Cidade: ${person.city}</div>` : ''}
      ${person.cpf ? `<div class="meta">CPF: ${person.cpf}</div>` : ''}
      <div class="meta">Lat: ${person.lat.toFixed(5)} · Lng: ${person.lng.toFixed(5)}</div>
      ${person.image ? `<img class="person-photo" src="${person.image}" alt="Foto de ${person.name}" />` : ''}
      <div class="actions">
        <button type="button" class="action-btn edit-btn" data-action="edit" data-id="${person.id}">Editar</button>
        <button type="button" class="action-btn delete-btn" data-action="delete" data-id="${person.id}">Apagar</button>
      </div>
    `;
    listEl.appendChild(item);

    const marker = L.marker([person.lat, person.lng]).addTo(markersLayer);
    const popupHtml = `
      <strong>${person.name}</strong><br>
      ${person.note ? `${person.note}<br>` : ''}
      ${person.cpf ? `CPF: ${person.cpf}<br>` : ''}
      ${person.birthdate ? `Nascimento: ${formatDate(person.birthdate)}<br>` : ''}
      ${person.phone ? `Telefone: ${person.phone}<br>` : ''}
      ${person.city ? `Cidade: ${person.city}<br>` : ''}
      ${person.cpf ? `CPF: ${person.cpf}<br>` : ''}
      ${person.image ? `<img src="${person.image}" alt="Foto de ${person.name}" style="width: 140px; max-height: 100px; object-fit: cover; border-radius: 8px; margin-top: 6px;" />` : ''}
    `;
    marker.bindPopup(popupHtml);

    marker.on('click', () => {
      statusEl.textContent = `Marcador de ${person.name} em ${person.lat.toFixed(5)}, ${person.lng.toFixed(5)}.`;
    });

    if (index === 0) {
      map.panTo([person.lat, person.lng]);
    }
  });
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
}

function startEditing(person) {
  editingId = person.id;
  nameInput.value = person.name;
  noteInput.value = person.note || '';
  personCpfInput.value = person.cpf || '';
  personBirthdateInput.value = person.birthdate || '';
  selectedLatLng = { lat: person.lat, lng: person.lng };
  statusEl.textContent = `Editando ${person.name}. Clique no mapa para mover a localização, depois salve.`;
  map.panTo([person.lat, person.lng]);
  nameInput.focus();
}

async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'pt-BR' }
    });
    const data = await response.json();

    if (!data.length) {
      searchStatusEl.textContent = 'Nenhum endereço encontrado.';
      return;
    }

    const result = data[0];
    const latLng = [Number(result.lat), Number(result.lon)];
    map.setView(latLng, 15);
    L.marker(latLng).addTo(markersLayer).bindPopup(result.display_name).openPopup();
    searchStatusEl.textContent = `Localizado: ${result.display_name}`;
  } catch (error) {
    console.error('Erro ao buscar endereço:', error);
    searchStatusEl.textContent = 'Não foi possível buscar esse endereço.';
  }
}

searchBtn.addEventListener('click', () => {
  const address = addressInput.value.trim();
  if (!address) {
    searchStatusEl.textContent = 'Digite um endereço para buscar.';
    return;
  }
  geocodeAddress(address);
});

useAddressBtn.addEventListener('click', async () => {
  const address = personAddressInput.value.trim();
  if (!address) {
    statusEl.textContent = 'Digite um endereço para usar no cadastro.';
    return;
  }

  const result = await geocodeAddressToLatLng(address);
  if (result) {
    selectedLatLng = { lat: result.lat, lng: result.lng };
    statusEl.textContent = `Endereço carregado: ${result.displayName}`;
    map.setView([result.lat, result.lng], 15);
  }
});

async function geocodeAddressToLatLng(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;

  try {
    const response = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    const data = await response.json();

    if (!data.length) {
      statusEl.textContent = 'Nenhum endereço encontrado.';
      return null;
    }

    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
      displayName: data[0].display_name
    };
  } catch (error) {
    console.error('Erro ao buscar endereço:', error);
    statusEl.textContent = 'Não foi possível buscar esse endereço.';
    return null;
  }
}

addressInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    searchBtn.click();
  }
});

map.on('click', (event) => {
  selectedLatLng = event.latlng;
  statusEl.textContent = `Posição selecionada: ${selectedLatLng.lat.toFixed(5)}, ${selectedLatLng.lng.toFixed(5)}.`;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!selectedLatLng) {
    statusEl.textContent = 'Primeiro clique no mapa para escolher a localização.';
    return;
  }

  const name = nameInput.value.trim();
  const note = noteInput.value.trim();
  const cpf = personCpfInput.value.trim();
  const birthdate = personBirthdateInput.value;

  if (!name) {
    statusEl.textContent = 'Informe o nome da pessoa.';
    return;
  }

  let imageData = null;
  const file = personImageInput.files && personImageInput.files[0];
  if (file) {
    imageData = await readImageAsDataUrl(file);
  }

  if (editingId) {
    people = people.map((person) =>
      person.id === editingId
        ? { ...person, name, note, cpf, birthdate, image: imageData || person.image, lat: selectedLatLng.lat, lng: selectedLatLng.lng }
        : person
    );
    statusEl.textContent = `Pessoa atualizada em ${selectedLatLng.lat.toFixed(5)}, ${selectedLatLng.lng.toFixed(5)}.`;
  } else {
    people.push({
      id: Date.now(),
      name,
      note,
      cpf,
      birthdate,
      image: imageData,
      lat: selectedLatLng.lat,
      lng: selectedLatLng.lng,
      createdAt: new Date().toISOString()
    });
    statusEl.textContent = `Pessoa salva em ${selectedLatLng.lat.toFixed(5)}, ${selectedLatLng.lng.toFixed(5)}.`;
  }

  savePeople();
  renderPeople();
  form.reset();
  editingId = null;
  selectedLatLng = null;
});

listEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;

  if (action === 'delete') {
    people = people.filter((person) => person.id !== id);
    savePeople();
    renderPeople();
    statusEl.textContent = 'Pessoa apagada com sucesso.';
    return;
  }

  if (action === 'edit') {
    const person = people.find((item) => item.id === id);
    if (person) {
      startEditing(person);
    }
  }
});

importCsvBtn.addEventListener('click', async () => {
  const file = csvInput.files && csvInput.files[0];
  if (!file) {
    csvStatusEl.textContent = 'Selecione um arquivo CSV antes de importar.';
    return;
  }

  const text = await file.text();
  const rows = parseCsv(text);

  if (!rows.length) {
    csvStatusEl.textContent = 'O CSV está vazio ou inválido.';
    return;
  }

  const imported = [];
  for (const row of rows) {
    const address = row.endereco || row.endereço || row.address || '';
    const name = row.nome || row.name || '';
    const note = row.observacao || row.observação || row.note || '';
    const phone = row.telefone || row.phone || '';
    const city = row.cidade || row.city || '';
    const cpf = row.cpf || '';

    if (!name || !address) continue;

    const geo = await geocodeAddressToLatLng(address);
    if (!geo) continue;

    imported.push({
      id: Date.now() + Math.random(),
      name,
      note,
      phone,
      city,
      cpf,
      image: null,
      lat: geo.lat,
      lng: geo.lng,
      createdAt: new Date().toISOString()
    });
  }

  if (!imported.length) {
    csvStatusEl.textContent = 'Nenhuma pessoa válida foi encontrada no CSV.';
    return;
  }

  people = people.concat(imported);
  savePeople();
  renderPeople();
  csvStatusEl.textContent = `${imported.length} pessoa(s) importada(s) com sucesso.`;
  csvInput.value = '';
});

renderPeople();
