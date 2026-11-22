import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './FanGallery.css';

const MAX_CARDS = 8;
const MIN_DECK = 5; 

const CARD_SIZE_BASE = 280; 
const CARD_ASPECT = 1.2;
const CARD_RADIUS = 24;
const FAN_ROTATION = 5; 
const FAN_SPREAD = 0.42; 
const SCALE_STEP = 0.22; 
const EDGE_SLOT = 2;
const GHOST_RANGE = 2; 
const MAX_OVERLAY = 0.45;

/* Physics */
const FRICTION = 0.92;
const SNAP_SPRING = 0.08;
const SNAP_DAMPING = 0.75;
const DRAG_SENSITIVITY = 0.004; // px -> scrollPos units


function getCardSize() {
  if (typeof window === 'undefined') return CARD_SIZE_BASE;
  const vw = window.innerWidth;
  if (vw < 480) return 180;
  if (vw < 640) return 210;
  if (vw < 768) return 240;
  if (vw < 1024) return 260;
  return CARD_SIZE_BASE;
}


function wrapIndex(index, n) {
  return ((index % n) + n) % n;
}

function easeOutQuart(t) {
  return 1 - (1 - t) ** 4;
}

function formatMoney(value) {
  return '₹' + Math.round(Number(value) || 0).toLocaleString('en-IN');
}

function deadlineLabel(deadline) {
  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return 'Open campaign';

  const days = Math.ceil((end - Date.now()) / 86400000);
  if (days < 0) return 'Deadline passed';
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends tomorrow';
  return `Ends in ${days} days`;
}

function firstLetter(title) {
  return (title || '?').trim().charAt(0).toUpperCase();
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.44 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95z" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}


export default function FanGallery({ campaigns }) {

  const deck = useMemo(() => (campaigns || []).slice(0, MAX_CARDS), [campaigns]);

  const n = deck.length;

  const [cardSize, setCardSize] = useState(getCardSize);
  const [centeredIndex, setCenteredIndex] = useState(0);
  const [dragging, setDragging] = useState(false);


  const stageRef = useRef(null);
  const cardRefs = useRef([]);
  const layersRef = useRef([]);
  const leftSlotRef = useRef(null);
  const rightSlotRef = useRef(null);
  const slotPartsRef = useRef({ left: null, right: null });

  
  const scrollPosRef = useRef(0);
  const velocityRef = useRef(0);
  const dragRef = useRef(null);
  const rafRef = useRef(null);
  const entranceRef = useRef([]);
  const enteringRef = useRef(true);
  const startedAtRef = useRef(0);
  const reduceMotionRef = useRef(false);
  const centeredRef = useRef(0);

 
  const deckRef = useRef(deck);
  const sizeRef = useRef(cardSize);
  deckRef.current = deck;
  sizeRef.current = cardSize;

  
  const cardHeight = cardSize * CARD_ASPECT;
  const spread = cardSize * FAN_SPREAD;
  const edgeScale = Math.max(0.5, 1 - EDGE_SLOT * SCALE_STEP);
  const edgeWidth = cardSize * edgeScale;
  const edgeHeight = cardHeight * edgeScale;
  const edgeRotation = FAN_ROTATION * EDGE_SLOT;

  const slotStyle = (side) => {
    const sign = side === 'left' ? -1 : 1;
    return {
      width: edgeWidth,
      height: edgeHeight,
      marginLeft: -edgeWidth / 2,
      marginTop: -edgeHeight / 2,
      borderRadius: CARD_RADIUS * edgeScale,
      transform: `translate3d(${sign * EDGE_SLOT * spread}px, 0px, 0px) rotate(${sign * edgeRotation}deg)`,
      opacity: 0
    };
  };


  const updateCards = useCallback(() => {
    const list = deckRef.current;
    const count = list.length;
    if (!stageRef.current || count === 0) return;

    const size = sizeRef.current;
    const step = size * FAN_SPREAD;
    const elapsed = (performance.now() - startedAtRef.current) / 1000;
    const reduce = reduceMotionRef.current;

  
    const maxDistance = Math.floor(count / 2);
    const lastDelay = maxDistance === 0 ? 0.3 : 0.7 + (maxDistance - 1) * 0.07;
    if (enteringRef.current && (reduce || elapsed >= lastDelay + 0.75)) {
      enteringRef.current = false;
    }
    const showEntrance = enteringRef.current;

    for (let i = 0; i < count; i += 1) {
      const card = cardRefs.current[i];
      if (!card) continue;

      
      let offset = i - scrollPosRef.current;
      offset = wrapIndex(offset, count);
      if (offset > count / 2) offset -= count;
      const absOffset = Math.abs(offset);

   
      const distance = Math.min(i, count - i);
      let progress = 1;
      if (showEntrance) {
        const delay = distance === 0 ? 0.3 : 0.7 + (distance - 1) * 0.07;
        const local = reduce ? 1 : Math.min(1, Math.max(0, (elapsed - delay) / 0.75));
        progress = easeOutQuart(local);
      }
      entranceRef.current[i] = progress;

      
      if (showEntrance && absOffset > EDGE_SLOT) {
        card.style.opacity = '0';
        card.style.visibility = 'hidden';
        continue;
      }
      if (!showEntrance && absOffset > EDGE_SLOT + GHOST_RANGE) {
        card.style.opacity = '0';
        card.style.visibility = 'hidden';
        continue;
      }

      const isGhost = !showEntrance && absOffset >= EDGE_SLOT;
      const ghostOpacity = isGhost
        ? Math.max(0, 1 - (absOffset - EDGE_SLOT) / GHOST_RANGE)
        : 1;

      const targetScale = Math.max(0.4, 1 - absOffset * SCALE_STEP);
      const scale = 0.3 + (targetScale - 0.3) * progress;

      card.style.visibility = 'visible';
      card.style.opacity = String(ghostOpacity * progress);
      card.style.zIndex = String(isGhost ? 0 : Math.round((EDGE_SLOT + 1 - absOffset) * 10));
      card.style.transform =
        `translate3d(${offset * step * progress}px, 0px, 0px) ` +
        `rotate(${offset * FAN_ROTATION * progress}deg) scale(${scale})`;

      
      let layers = layersRef.current[i];
      if (!layers) {
        layers = {
          image: card.querySelector('[data-image]'),
          overlay: card.querySelector('[data-overlay]'),
          ghost: card.querySelector('[data-ghost]'),
          border: card.querySelector('[data-border]'),
          shadow: card.querySelector('[data-shadow]')
        };
        layersRef.current[i] = layers;
      }

      if (layers.overlay) {
        layers.overlay.style.opacity = isGhost
          ? '0'
          : String(Math.min(MAX_OVERLAY, (absOffset / EDGE_SLOT) * MAX_OVERLAY));
      }
      if (layers.image) layers.image.style.opacity = isGhost ? '0' : '1';
      if (layers.ghost) layers.ghost.style.opacity = isGhost ? '1' : '0';
      if (layers.shadow) layers.shadow.style.opacity = isGhost ? '0' : '1';
      if (layers.border) {
        layers.border.style.opacity = isGhost
          ? '0'
          : String(Math.max(0, 1 - absOffset * 2.5));
      }
    }

   
    const slotProgress = entranceRef.current[wrapIndex(EDGE_SLOT, count)] ?? 1;
    const slotRotation = FAN_ROTATION * EDGE_SLOT;
    const sides = [
      { side: 'left', sign: -1, el: leftSlotRef.current },
      { side: 'right', sign: 1, el: rightSlotRef.current }
    ];
    for (const { side, sign, el } of sides) {
      if (!el) continue;
      if (count < MIN_DECK) {
        el.style.opacity = '0';
        continue;
      }
      el.style.opacity = String(slotProgress);
      el.style.transform =
        `translate3d(${sign * EDGE_SLOT * step * slotProgress}px, 0px, 0px) ` +
        `rotate(${sign * slotRotation * slotProgress}deg) ` +
        `scale(${0.4 + 0.6 * slotProgress})`;


      const index = side === 'left'
        ? wrapIndex(Math.floor(scrollPosRef.current) - EDGE_SLOT, count)
        : wrapIndex(Math.ceil(scrollPosRef.current) + EDGE_SLOT, count);
      const item = list[index];
      const parts = slotPartsRef.current[side];
      if (item && parts) {
        if (item.imageUrl) {
          if (parts.img.getAttribute('src') !== item.imageUrl) parts.img.src = item.imageUrl;
          parts.img.style.display = 'block';
          parts.letter.style.display = 'none';
        } else {
          parts.img.style.display = 'none';
          parts.letter.textContent = firstLetter(item.title);
          parts.letter.style.display = 'grid';
        }
      }
    }

  
    const nextCenter = wrapIndex(Math.round(scrollPosRef.current), count);
    if (nextCenter !== centeredRef.current) {
      centeredRef.current = nextCenter;
      setCenteredIndex(nextCenter);
    }
  }, []);


  const frame = useCallback(function loop() {
    rafRef.current = null;

    const isDragging = Boolean(dragRef.current?.active);

    if (!isDragging) {
      scrollPosRef.current += velocityRef.current;
      velocityRef.current *= FRICTION;

      if (Math.abs(velocityRef.current) < 0.15) {
        const nearest = Math.round(scrollPosRef.current);
        velocityRef.current += (nearest - scrollPosRef.current) * SNAP_SPRING;
        velocityRef.current *= SNAP_DAMPING;
      }

      if (Math.abs(velocityRef.current) < 0.0005) {
        velocityRef.current = 0;
        if (Math.abs(scrollPosRef.current - Math.round(scrollPosRef.current)) < 0.01) {
          scrollPosRef.current = Math.round(scrollPosRef.current);
        }
      }
    }

    updateCards();

    const busy =
      isDragging ||
      velocityRef.current !== 0 ||
      Math.abs(scrollPosRef.current - Math.round(scrollPosRef.current)) > 0.001 ||
      enteringRef.current;

    if (busy) rafRef.current = requestAnimationFrame(loop);
  }, [updateCards]);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(frame);
  }, [frame]);

  
  useEffect(() => {
    reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    startedAtRef.current = performance.now();

  
    const left = leftSlotRef.current;
    const right = rightSlotRef.current;
    slotPartsRef.current = {
      left: left
        ? { img: left.querySelector('img'), letter: left.querySelector('.fan-slot-letter') }
        : null,
      right: right
        ? { img: right.querySelector('img'), letter: right.querySelector('.fan-slot-letter') }
        : null
    };

    updateCards();
    startLoop();

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [updateCards, startLoop]);

  useEffect(() => {
    function handleResize() {
      setCardSize(getCardSize());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  useEffect(() => {
    updateCards();
    startLoop();
  }, [cardSize, deck, updateCards, startLoop]);

  
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    function handleWheel(event) {
      const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const delta = horizontal ? event.deltaX : (event.shiftKey ? event.deltaY : 0);
      if (Math.abs(delta) < 2) return; // let normal vertical scrolling through

      event.preventDefault();
      scrollPosRef.current += delta * 0.003;
      velocityRef.current = delta * 0.001;
      startLoop();
    }

    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, [startLoop]);

  
  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      decided: false,
      active: false
    };
    velocityRef.current = 0;
    stageRef.current?.focus({ preventScroll: true });
  }
  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const now = performance.now();

    if (!drag.decided) {
      const movedX = Math.abs(event.clientX - drag.startX);
      const movedY = Math.abs(event.clientY - drag.startY);
      if (movedX < 8 && movedY < 8) return;

      drag.decided = true;
      if (movedY > movedX * 1.2) {
        dragRef.current = null;
        return;
      }

      drag.active = true;
      setDragging(true);
      try {
        stageRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is not supported in every browser.
      }
    }

    if (!drag.active) return;

    const dx = event.clientX - drag.lastX;
    const dt = Math.max(1, now - drag.lastTime);
    drag.lastX = event.clientX;
    drag.lastTime = now;

    scrollPosRef.current -= dx * DRAG_SENSITIVITY;
    velocityRef.current = ((-dx * DRAG_SENSITIVITY) / dt) * 16;
    startLoop();
  }

  function endDrag() {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.active) {
      if (performance.now() - drag.lastTime > 120) velocityRef.current = 0;
      else velocityRef.current *= 1.1; 

      setDragging(false);
      startLoop();
      try {
        stageRef.current?.releasePointerCapture(drag.pointerId);
      } catch {
        // Pointer capture is not supported in every browser.
      }
    }

    dragRef.current = null;
  }

  function handleKeyDown(event) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    velocityRef.current = (event.key === 'ArrowRight' ? 1 : -1) * 0.24;
    startLoop();
  }

  
  if (n === 0) return null;

  const current = deck[centeredIndex % n] ?? deck[0];
  const raised = Number(current.totalRaised) || 0;
  const goal = Number(current.goal) || 0;
  const percent = goal > 0 ? Math.round((raised / goal) * 100) : 0;
  const campaignPath = `/campaign/${current._id}`;

  return (
    <section className="fan-section" aria-labelledby="fan-heading">
      <div className="fan-header">
        <h2 className="fan-title" id="fan-heading" data-reveal>
          Fund the next big idea.
        </h2>

        <p className="fan-sub" data-reveal>
          A deck of live campaigns, ready to flip through. Drag the cards, scroll
          sideways, or use the arrow keys — every pledge updates the total in real time.
        </p>
      </div>

      <div
        ref={stageRef}
        className={'fan-stage' + (dragging ? ' is-dragging' : '')}
        style={{ height: cardHeight + 40 }}
        role="group"
        aria-roledescription="carousel"
        aria-label="Campaigns. Drag sideways or use the arrow keys."
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={handleKeyDown}
      >
        <div ref={leftSlotRef} className="fan-slot" style={slotStyle('left')} aria-hidden="true">
          <img alt="" draggable="false" style={{ display: 'none' }} />
          <span className="fan-slot-letter" />
          <span className="fan-slot-veil" />
        </div>

        <div ref={rightSlotRef} className="fan-slot" style={slotStyle('right')} aria-hidden="true">
          <img alt="" draggable="false" style={{ display: 'none' }} />
          <span className="fan-slot-letter" />
          <span className="fan-slot-veil" />
        </div>

        {deck.map((campaign, i) => (
          <article
            key={i}
            ref={(element) => { cardRefs.current[i] = element; }}
            className="fan-card"
            style={{
              width: cardSize,
              height: cardHeight,
              marginLeft: -cardSize / 2,
              marginTop: -cardHeight / 2,
              borderRadius: CARD_RADIUS,
              opacity: 0
            }}
            aria-hidden={i !== centeredIndex}
          >
            <div className="fan-card-image" data-image>
              {campaign.imageUrl ? (
                <img src={campaign.imageUrl} alt="" draggable="false" />
              ) : (
                <div className="fan-card-fallback" aria-hidden="true">
                  {firstLetter(campaign.title)}
                </div>
              )}
              <div className="fan-card-overlay" data-overlay />
              <div className="fan-card-ring" />
            </div>

            <div className="fan-card-ghost" data-ghost />
            <div className="fan-card-border" data-border />
            <div className="fan-card-shadow" data-shadow />
          </article>
        ))}
      </div>

      <div className="fan-info" aria-live="polite">
        <div className="fan-info-meta" data-info-reveal>
          <span>{current.category || 'Campaign'}</span>
          <span aria-hidden="true">·</span>
          <StarIcon />
          <span>{Number(current.supportersCount) || 0} supporters</span>
        </div>

        <h3 className="fan-info-title" data-info-reveal>{current.title}</h3>

        <div className="fan-price" data-info-reveal>
          <span className="fan-price-now">{formatMoney(raised)}</span>
          <span className="fan-price-side">
            <span className="fan-price-goal">of {formatMoney(goal)} goal</span>
            <span className="fan-discount">{percent}% funded</span>
          </span>
        </div>

        <div className="fan-actions" data-info-reveal>
          <Link className="fan-primary" to={campaignPath}>
            <BagIcon />
            Pledge now
          </Link>
          <Link className="fan-secondary" to={campaignPath}>
            View details
            <ArrowIcon />
          </Link>
        </div>

        <p className="fan-trust" data-info-reveal>
          <span className="fan-live-dot" aria-hidden="true" />
          <span>Accepting pledges</span>
          <span aria-hidden="true">·</span>
          <span>{deadlineLabel(current.deadline)}</span>
          <span aria-hidden="true">·</span>
          <span>Mock payments only</span>
        </p>
      </div>
    </section>
  );
}
