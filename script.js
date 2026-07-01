document.addEventListener('DOMContentLoaded',function(){
  var pl=document.getElementById('preloader');
  window.addEventListener('load',function(){pl.classList.add('hidden')});
  setTimeout(function(){if(!pl.classList.contains('hidden'))pl.classList.add('hidden')},2500);
  var nb=document.getElementById('navbar');
  window.addEventListener('scroll',function(){nb.classList.toggle('scrolled',window.scrollY>60)});
  var nt=document.getElementById('navToggle'),nm=document.getElementById('navMenu');
  nt.addEventListener('click',function(){nt.classList.toggle('active');nm.classList.toggle('active')});
  nm.querySelectorAll('.nav-link,.nav-cta').forEach(function(l){l.addEventListener('click',function(){nt.classList.remove('active');nm.classList.remove('active')})});
  var ro=new IntersectionObserver(function(e){e.forEach(function(entry){
    if(entry.isIntersecting){var d=parseInt(entry.target.dataset.aosDelay)||0;setTimeout(function(){entry.target.classList.add('visible')},d);ro.unobserve(entry.target)}
  })},{rootMargin:'0px 0px -50px 0px',threshold:.1});
  document.querySelectorAll('[data-aos]').forEach(function(el){ro.observe(el)});
  function animCounter(el){var t=parseInt(el.dataset.count);if(isNaN(t))return;var c=0,i=Math.ceil(t/40);var ti=setInterval(function(){c+=i;if(c>=t){c=t;clearInterval(ti)}el.textContent=c.toLocaleString()},30)}
  var co=new IntersectionObserver(function(e){e.forEach(function(entry){if(entry.isIntersecting){animCounter(entry.target);co.unobserve(entry.target)}})},{threshold:.5});
  document.querySelectorAll('.stat-number').forEach(function(c){co.observe(c)});
  var ts=45*60+32,dt=document.getElementById('demoTimer');
  if(dt)setInterval(function(){if(ts<=0)ts=90*60;ts--;var m=Math.floor(ts/60),s=ts%60;dt.innerHTML='<i class="fas fa-clock"></i> '+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')},1000);
  window.claimDemo=function(){showToast('🎉 You claimed this listing! Show this at pickup.','success')};
  var ld=[
    {id:1,name:'Chicken Biryani Combo (4 pcs)',restaurant:'The Spice House',category:'discounted',price:250,original:600,distance:'1.2 km',time:'55 min left',cuisine:'North Indian'},
    {id:2,name:'Mixed Veg Thali (6 pcs)',restaurant:'Sagar Delights',category:'donation',price:0,original:null,distance:'0.8 km',time:'35 min left',cuisine:'South Indian'},
    {id:3,name:'Butter Chicken + Naan (3 pcs)',restaurant:'Punjab Dhaba',category:'discounted',price:180,original:450,distance:'2.5 km',time:'70 min left',cuisine:'North Indian'},
    {id:4,name:'Fresh Fruit Box (5 pcs)',restaurant:'Green Bowl Cafe',category:'donation',price:0,original:null,distance:'0.5 km',time:'25 min left',cuisine:'Healthy'},
    {id:5,name:'Idli & Vada Combo (10 pcs)',restaurant:'Udupi Grand',category:'discounted',price:120,original:300,distance:'1.8 km',time:'40 min left',cuisine:'South Indian'},
    {id:6,name:"Assorted Pastries (8 pcs)",restaurant:"Baker's Treat",category:'discounted',price:160,original:400,distance:'3.1 km',time:'60 min left',cuisine:'Bakery'},
    {id:7,name:'Dal Makhani + Rice (6 pcs)',restaurant:'Tandoori Nights',category:'donation',price:0,original:null,distance:'2.0 km',time:'45 min left',cuisine:'North Indian'},
    {id:8,name:'Paneer Roll (4 pcs)',restaurant:'Roll Express',category:'discounted',price:90,original:240,distance:'0.3 km',time:'20 min left',cuisine:'Street Food'}
  ];
  var lg=document.getElementById('listingsGrid'),af='all',sq='';
  function rl(){
    var f=ld.filter(function(i){return(af==='all'||i.category===af)&&(i.name.toLowerCase().includes(sq)||i.restaurant.toLowerCase().includes(sq)||i.cuisine.toLowerCase().includes(sq))});
    if(!f.length){lg.innerHTML='<div class="no-results">No listings match. Try a different filter.</div>';return}
    lg.innerHTML=f.map(function(i){
      var p=i.category==='donation'?'<span class="li-price free">FREE</span>':'<span class="li-price">₹'+i.price+'</span>';
      var o=i.original?'<span class="li-original">₹'+i.original+'</span>':'';
      return '<div class="listing-item '+i.category+'"><span class="li-category">'+(i.category==='discounted'?'Discounted':'Free Donation')+'</span><div class="li-restaurant"><i class="fas fa-store"></i> '+i.restaurant+'</div><div class="li-name">'+i.name+'</div><div class="li-meta"><span><i class="fas fa-location-dot"></i> '+i.distance+'</span><span><i class="fas fa-clock"></i> '+i.time+'</span><span><i class="fas fa-utensils"></i> '+i.cuisine+'</span></div><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'+p+o+'</div><button class="btn-primary btn-sm" onclick="claimListing('+i.id+')"><i class="fas fa-hand"></i> Claim Now</button></div>'
    }).join('');
  }
  window.claimListing=function(id){var i=ld.find(function(x){return x.id===id});if(i)showToast('✅ Claimed! "'+i.name+'" from '+i.restaurant+'. Show OTP at pickup.','success')};
  document.querySelectorAll('.filter-btn').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.filter-btn').forEach(function(x){x.classList.remove('active')});b.classList.add('active');af=b.dataset.filter;rl()})});
  var si=document.getElementById('demoSearch');if(si)si.addEventListener('input',function(){sq=this.value.toLowerCase();rl()});
  rl();
  document.querySelectorAll('.faq-question').forEach(function(q){q.addEventListener('click',function(){var i=this.parentElement,a=i.classList.contains('active');document.querySelectorAll('.faq-item').forEach(function(f){f.classList.remove('active')});if(!a)i.classList.add('active')})});
  var cf=document.getElementById('contactForm');
  if(cf){cf.addEventListener('submit',function(e){e.preventDefault();var n=document.getElementById('formName').value.trim(),em=document.getElementById('formEmail').value.trim();var t=document.getElementById('formType').value,c=document.getElementById('formCity').value.trim();if(!n||!em){showToast('Please fill in your name and email.','error');return}showToast('🎉 Thanks, '+n+'! You\'re on the waitlist as a '+t+'. We\'ll notify you.','success');cf.reset()})}
  var bt=document.getElementById('backToTop');window.addEventListener('scroll',function(){bt.classList.toggle('visible',window.scrollY>400)});bt.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
  function showToast(m,t){var to=document.getElementById('toast');to.textContent=m;to.className='toast show '+(t||'');clearTimeout(to._timeout);to._timeout=setTimeout(function(){to.classList.remove('show')},4000)}window.showToast=showToast;
  document.querySelectorAll('a[href^="#"]').forEach(function(a){a.addEventListener('click',function(e){var h=this.getAttribute('href');if(h==='#'||!h)return;var t=document.querySelector(h);if(t){e.preventDefault();window.scrollTo({top:t.getBoundingClientRect().top+window.pageYOffset-80,behavior:'smooth'})}})});
});
