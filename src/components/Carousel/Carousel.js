import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import './Carousel.css'; // Align this CSS with your brand
const Carousel = () => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const slides = [
        {
            imgSrc: "/src/assets/img/Lifestyle.jpeg",
            description: "Slide 1 - Product Highlight",
        },
        {
            imgSrc: "/src/assets/img/Infographic.jpeg",
            description: "Slide 2 - Special Feature",
        },
        {
            imgSrc: "/src/assets/img/Listing.jpeg",
            description: "Slide 3 - New Arrival",
        },
    ];
    const handlePrev = () => {
        setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    };
    const handleNext = () => {
        setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    };
    return (_jsxs("div", { className: "carousel-container", children: [_jsx("div", { className: "carousel-slides", children: slides.map((slide, index) => (_jsxs("div", { className: `slide ${index === currentSlide ? 'active' : ''}`, children: [_jsx("img", { src: slide.imgSrc, alt: `Slide ${index}` }), _jsx("p", { children: slide.description })] }, index))) }), _jsx("button", { className: "prev", onClick: handlePrev, "aria-label": "Previous Slide", children: "\u276E" }), _jsx("button", { className: "next", onClick: handleNext, "aria-label": "Next Slide", children: "\u276F" })] }));
};
export default Carousel;
