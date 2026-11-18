// Default content used the first time the server starts (written to data/db.json).
const U = (id, w = 900) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`;

let n = 0;
const id = (p) => `${p}_${(++n).toString(36)}${Date.now().toString(36).slice(-4)}`;

module.exports = function seed() {
  const categories = [
    { id: 'biryani', name: 'Biryani & Rice', order: 1 },
    { id: 'curries', name: 'Malabar Curries', order: 2 },
    { id: 'grills', name: 'Grills & Tandoor', order: 3 },
    { id: 'breads', name: 'Breads', order: 4 },
    { id: 'snacks', name: 'Snacks & Starters', order: 5 },
    { id: 'meals', name: 'Meals', order: 6 },
  ];

  const menu = [
    { name: 'Thalassery Dum Biryani', category: 'biryani', price: 260, veg: false, signature: true, description: 'Fragrant kaima rice slow-cooked on dum with tender chicken, fried onions and ghee.', image: U('photo-1563379091339-03b21ab4a4f8') },
    { name: 'Mutton Dum Biryani', category: 'biryani', price: 340, veg: false, signature: false, description: 'Kaima rice layered with slow-cooked mutton and Malabar spices.', image: U('photo-1589302168068-964664d93dc0') },
    { name: 'Prawn Biryani', category: 'biryani', price: 320, veg: false, signature: false, description: 'Coastal-style biryani with juicy prawns and fresh herbs.', image: U('photo-1645177628172-a94c1f96e6db') },
    { name: 'Chicken Kuzhimandi', category: 'biryani', price: 290, veg: false, signature: false, description: 'Smoky Arabian-style rice with pit-roasted chicken.', image: U('photo-1631515243349-e0cb75fb8d3a') },
    { name: 'Chicken Chatti Curry', category: 'curries', price: 220, veg: false, signature: true, description: 'Home-style chicken curry simmered in a clay pot with roasted coconut.', image: U('photo-1574653853027-5382a3d23a15') },
    { name: 'Malabar Mutton Curry', category: 'curries', price: 300, veg: false, signature: false, description: 'Rich, peppery mutton curry the Thalassery way.', image: U('photo-1596797038530-2c107229654b') },
    { name: 'Beef Ularthiyathu', category: 'curries', price: 240, veg: false, signature: false, description: 'Slow-roasted beef with coconut slivers and curry leaves.', image: U('photo-1505253758473-96b7015fcd40') },
    { name: 'Chicken Tandoori', category: 'grills', price: 280, veg: false, signature: true, description: 'Chicken marinated overnight in yoghurt and spices, charred in the tandoor.', image: U('photo-1599487488170-d11ec9c172f0') },
    { name: 'Paneer Tikka', category: 'grills', price: 230, veg: true, signature: false, description: 'Cottage cheese and peppers grilled with a smoky tikka marinade.', image: U('photo-1567188040759-fb8a883dc6d8') },
    { name: 'Kerala Parotta', category: 'breads', price: 25, veg: true, signature: true, description: 'Flaky, layered flatbread, hand-beaten and griddled to order.', image: U('photo-1565557623262-b51c2513a641') },
    { name: 'Chilli Chicken', category: 'snacks', price: 210, veg: false, signature: false, description: 'Crispy chicken tossed with peppers, onions and chilli.', image: U('photo-1628294895950-9805252327bc') },
    { name: 'Chicken Samosa', category: 'snacks', price: 60, veg: false, signature: false, description: 'Malabar-style samosas stuffed with spiced chicken mince.', image: U('photo-1601050690597-df0568f70950') },
    { name: 'Kerala Sadya Meals', category: 'meals', price: 180, veg: true, signature: false, description: 'Rice, sambar, avial, thoran, pickle and pappadam on a banana leaf.', image: U('photo-1585937421612-70a008356fbe') },
  ].map((m, i) => ({ id: id('m'), available: true, order: i + 1, ...m }));

  const gallery = [
    { title: 'Thalassery Dum Biryani', image: U('photo-1563379091339-03b21ab4a4f8', 1200) },
    { title: 'Our dining hall', image: U('photo-1555396273-367ea4eb4db5', 1200) },
    { title: 'Chicken Chatti Curry', image: U('photo-1574653853027-5382a3d23a15', 1200) },
    { title: 'From the tandoor', image: U('photo-1599487488170-d11ec9c172f0', 1200) },
    { title: 'Evening ambience', image: U('photo-1517248135467-4c7edcad34c4', 1200) },
    { title: 'Kerala meals', image: U('photo-1585937421612-70a008356fbe', 1200) },
    { title: 'Mutton Biryani', image: U('photo-1589302168068-964664d93dc0', 1200) },
    { title: 'Friends & family', image: U('photo-1514933651103-005eec06c04b', 1200) },
  ].map((g, i) => ({ id: id('g'), order: i + 1, ...g }));

  const now = Date.now();
  const reviews = [
    { name: 'Arjun Menon', rating: 5, text: 'Best Thalassery biryani outside Kerala. Tasted just like home. The chatti curry is a must-try!' },
    { name: 'Priya S', rating: 5, text: 'Warm staff, cosy place on a cold Ooty evening, and the parottas were perfect.' },
    { name: 'Rahul K', rating: 4, text: 'Authentic Malabar flavours and generous portions. Great spot for families.' },
  ].map((r, i) => ({ id: id('r'), approved: true, createdAt: new Date(now - (i + 1) * 86400000 * 3).toISOString(), ...r }));

  const slides = [
    { script: 'A Taste of Malabar,', title: 'Served with Tradition.', text: 'Experience the authentic Thalassery flavours right here in the heart of Ooty.', image: U('photo-1563379091339-03b21ab4a4f8', 1600), label: 'Thalassery Dum Biryani' },
    { script: 'Slow-cooked in clay,', title: 'Spiced with Love.', text: 'Our chatti curries are simmered the old way: patiently, in earthen pots.', image: U('photo-1574653853027-5382a3d23a15', 1600), label: 'Chicken Chatti Curry' },
    { script: 'Fresh from the tandoor,', title: 'Made for Sharing.', text: 'Gather your family for grills, parottas and good conversation.', image: U('photo-1599487488170-d11ec9c172f0', 1600), label: 'Chicken Tandoori' },
  ].map((s, i) => ({ id: id('s'), order: i + 1, ...s }));

  return {
    settings: {
      name: 'Thalassery Thakkaram',
      location: 'Ooty',
      tagline: 'Good Food · Great Mood',
      address: 'Sarkar Palace, 5E, Kotagiri Road, Pudumund, Ooty',
      phone: '+91 98765 43210',
      whatsapp: '919876543210',
      email: 'hello@thalasserythakkaram.in',
      hours: 'Mon – Sun · 11:30 AM – 10:30 PM',
      mapQuery: 'Kotagiri Road, Pudumund, Ooty, Tamil Nadu',
      instagram: 'https://instagram.com/',
      facebook: 'https://facebook.com/',
      youtube: 'https://youtube.com/',
      storyTitle: 'A Culinary Journey from Malabar...',
      storyText: 'Bringing the rich flavours of Thalassery to Ooty, with authentic recipes, fresh ingredients and a passion for good food.',
      storyLong: 'Thalassery, on the Malabar coast of Kerala, is famous for its biryani, made with short-grain kaima rice, slow-cooked on dum and finished with ghee and fried onions. Our kitchen carries those family recipes up into the Nilgiris, cooking every dish fresh each day with spices sourced from Kerala. Whether you are a homesick Malayali or tasting Malabar for the first time, we will make you feel at home.',
      storyImage: U('photo-1585937421612-70a008356fbe', 1000),
      storefrontImage: U('photo-1517248135467-4c7edcad34c4', 900),
      announcement: '',
    },
    categories,
    menu,
    gallery,
    reviews,
    slides,
    reservations: [],
    admin: null, // created on first boot with default password
  };
};
