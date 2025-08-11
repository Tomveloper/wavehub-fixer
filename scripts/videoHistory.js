init();

async function init() {
	console.log("video history js");

	hideOriginalPlayerCSS();

	// waits and gets "main" element
	const main = await new Promise(res => {
		const mainMO = new MutationObserver((changes, MO) => {
			const main = document.querySelector("main");
			if (main) {
				MO.disconnect();
				res(main);
			}
		});

		mainMO.observe(document, { childList: true, subtree: true });
	});

	manageNewPlayer();
}

function hideOriginalPlayerCSS() {
	const css = document.createElement("style");
	css.innerHTML = `
	main > div.w-full > *:not(div:first-of-type, .wf-player) {
		display: none !important;
	}

	header.sticky {
		position: relative !important;
	}
	`;
	document.head.appendChild(css);
}


// calls back with original player src and each time it is changed
async function trackOriginalPlayer(callback) {

	const main = document.querySelector("main");

	let src; // current src of original player
	checkPlayer();


	const playerMO = new MutationObserver((changes, MO) => {
		checkPlayer();
	});
	playerMO.observe(main, { childList: true, subtree: true }); // observes for changes to original player


	function checkPlayer() { // checks if src of original player changes and updates

		let player = main.querySelector("video");
		if (src == player?.src) return;

		src = player.src;
		callback(src);
	}

}

async function manageNewPlayer() {
	const main = document.querySelector("main");
	const container = main.querySelector("div:first-of-type");

	const player = document.createElement("div");
	player.className = "wf-player";
	player.innerHTML =
		`
	<div class="wf-video-container">
		<video class="wf-video" autoplay=""></video>
		<div class="wf-video-action"></div>
		<div class="wf-video-overlay" style="bottom: 0;left: 4px;">zoom: 100%</div>
	</div>
	
	<div class="wf-player-controls-container" dir="ltr">

	</div>
	`;

	const video = player.querySelector(".wf-video");
	const playerControls = player.querySelector(".wf-player-controls-container");

	container.appendChild(player);

	handlePlayerControls(video, playerControls);


	trackOriginalPlayer(src => {
		video.src = src;
	});
}

function handlePlayerControls(video, controls) {
	controls.innerHTML = `
	<span class="wf-player-controls-handle">IIII</span>
	<div class="wf-player-controls">
		<div class="wf-player-timeline">
			<div class="wf-player-timeline-bar"></div>
			<div class="wf-player-current-time"></div>
		</div>
	</div>
	`;

	const handle = controls.querySelector(".wf-player-controls-handle");
	let handleX = 10;
	let handleY = 90;
	handleElementDrag(controls, handle, handleX, handleY);



	const timeline = controls.querySelector(".wf-player-timeline");
	handleTimeline(timeline, video);



	handleTransformControl(video);
}

function handleElementDrag(element, handle, startX = 0, startY = 0) {

	let holdingHandle = false;
	let currentX = startX;
	let currentY = startY;

	function verticalPixelToUnit(px) {
		const verticalPixels = window.innerHeight;
		return (100 / verticalPixels) * px;
	}

	function horizontalPixelToUnit(px) {
		const horizontalPixels = window.innerWidth;
		return (100 / horizontalPixels) * px;
	}

	updatePosition();
	function updatePosition() {
		element.style.left = currentX + "vw";
		element.style.top = currentY + "vh";
	}

	const onMouseMove = e => {
		if (holdingHandle) {
			currentX += horizontalPixelToUnit(e.movementX);
			currentY += verticalPixelToUnit(e.movementY);

			updatePosition();
		}
	};

	handle.addEventListener('mousedown', () => {
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);

		holdingHandle = true;
	});

	function onMouseUp(e) {
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', onMouseUp);

		holdingHandle = false;
	}


}

function handleTimeline(timeline, video) {

	let pressingTimeline = false;
	let resized = true;
	let currentPercent = 0;
	let timelinePos;

	const effect = new KeyframeEffect(
		timeline,
		[
			{ "--wf-timeline-progress": "0%" },
			{ "--wf-timeline-progress": "100%" }
		],
		{ fill: "both", duration: 1000 }
	)
	const progressingAnimation = new Animation(effect);



	const onMouseMove = e => { if (pressingTimeline) updateTimeline(e) };

	timeline.addEventListener('mousedown', e => {

		pressingTimeline = true;
		pauseTimelineAnimation();
		updateTimeline(e);

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	});

	function onMouseUp(e) {
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', onMouseUp);

		pressingTimeline = false;

		seek();
	}

	window.addEventListener("resize", () => resized = true);

	window.addEventListener("keydown", e => {
		if (e.code === "Space") {
			e.preventDefault(); // prevent default spacebar behavior (e.g., page scrolling)
			if (video.paused) {
				video.play();
			} else {
				video.pause();
			}
		}
	});



	function updateTimeline(e) {
		if (resized) { // if window is resized update position
			timelinePos = timeline.getBoundingClientRect();
			resized = false;
		}

		currentPercent = (e.clientX - timelinePos.x) / timelinePos.width;

		// update timeline visual/animation
		if (isNaN(video.duration)) return;

		const currentSecond = video.duration * currentPercent;
		progressingAnimation.currentTime = currentSecond * 1000; // convert to ms
	}

	function seek() {
		if (isNaN(video.duration)) return;
		video.currentTime = video.duration * currentPercent;
	}





	// update the animation duration (converted to ms)
	video.addEventListener("durationchange", () => effect.updateTiming({ "duration": video.duration * 1000 }));

	video.addEventListener("waiting", () => { pauseTimelineAnimation(); videoLoading(); });
	video.addEventListener("pause", () => { pauseTimelineAnimation(); videoAction("paused"); });
	video.addEventListener("seeking", () => { pauseTimelineAnimation(); videoLoading(); });
	video.addEventListener("ended", () => { pauseTimelineAnimation(); });

	video.addEventListener("playing", () => { playTimelineAnimation(); });
	video.addEventListener("play", () => { playTimelineAnimation(); videoAction("resumed"); });
	video.addEventListener("seeked", () => { videoLoaded(); });
	//video.addEventListener("play", playTimelineAnimation);

	function videoLoading() {
		video.parentElement.classList.add("wf-video-loading");
	}

	function videoLoaded() {
		video.parentElement.classList.remove("wf-video-loading");
	}

	const videoActionElement = video.parentElement.querySelector(".wf-video-action");

	function videoAction(action) {
		videoActionElement.innerText = action;
		videoActionElement.animate(
			[
				{ opacity: 1 },
				{ opacity: 0 }
			],
			{
				fill: "both",
				duration: 1000,
				easing: "linear"
			}
		)
	}

	function playTimelineAnimation() {
		progressingAnimation.play();
		videoLoaded();
	}

	function pauseTimelineAnimation() {
		progressingAnimation.pause();
	}


}

function handleTransformControl(video) {
	const container = video.parentElement;
	const zoomOverlay = container.querySelector(".wf-video-overlay");

	let scaling = 1;
	let videoX = 0;
	let videoY = 0;
	let maxVideoX = 0;
	let maxVideoY = 0;
	let fullscreen = false;

	function pixelToPercent(pixels, size) {
		return pixels / size;
	}

	container.addEventListener("wheel", e => {
		e.preventDefault();

		let step = 0.1;
		if (e.deltaY > 0) step *= -1; // correct for scrolling direction
		const multi = 1 + step;

		const containerRect = container.getBoundingClientRect();

		// make sure video always fills the container by not letting it be scaled below 1
		scaling = Math.max(1, scaling * multi);
		zoomOverlay.innerText = `zoom: ${Math.round(scaling * 100)}%`;


		// zoom to cursor

		const cursorOffsetX = pixelToPercent(e.clientX - containerRect.left - (containerRect.width / 2), containerRect.width) - videoX;
		const cursorOffsetY = pixelToPercent(e.clientY - containerRect.top - (containerRect.height / 2), containerRect.height) - videoY;

		videoX -= cursorOffsetX * multi - cursorOffsetX;
		videoY -= cursorOffsetY * multi - cursorOffsetY;



		// make sure video always fills the container by not letting you move it out of bounds
		maxVideoX = pixelToPercent(containerRect.width * Math.max(0, scaling - 1) / 2, containerRect.width);
		maxVideoY = pixelToPercent(containerRect.height * Math.max(0, scaling - 1) / 2, containerRect.height);

		videoX = clamp(videoX, -maxVideoX, maxVideoX);
		videoY = clamp(videoY, -maxVideoY, maxVideoY);

		updateTransform();
	});

	const onMouseMove = e => {

		const containerRect = container.getBoundingClientRect();

		videoX = clamp(videoX + pixelToPercent(e.movementX, containerRect.width), -maxVideoX, maxVideoX);
		videoY = clamp(videoY + pixelToPercent(e.movementY, containerRect.height), -maxVideoY, maxVideoY);

		updateTransform();
	};

	container.addEventListener('mousedown', () => {
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	});

	function onMouseUp(e) {
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', onMouseUp);
	}

	function updateTransform() {
		video.style.scale = `${scaling}`;
		video.style.translate = `${videoX * 100}% ${videoY * 100}%`;
	}

	// remember scroll after unfullscreening
	let pageScroll = 0;
	let scrollContainer = document.documentElement;

	window.addEventListener("keydown", e => {
		if (e.code === 'KeyF') {

			e.preventDefault();

			if (fullscreen) {

				container.classList.remove("wf-fullscreen");

				document.exitFullscreen();

				scrollContainer.scrollTo({
					top: pageScroll,
					behavior: "instant",
				});

				fullscreen = false;
			} else {

				pageScroll = scrollContainer.scrollTop;

				container.classList.add("wf-fullscreen");

				document.documentElement.requestFullscreen();

				fullscreen = true;
			}

		}
	});
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}