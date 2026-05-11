import React, { useState } from 'react';
import './Carousel.css'; // Align this CSS with your brand
import { PLACEHOLDER_IMAGE_BRAND } from "../../catalog/pdpImage";

const slides = [
        {
            imgSrc: PLACEHOLDER_IMAGE_BRAND,
            description: "Slide 1 — Brand",
        },
        {
            imgSrc: "/assets/img/placeholder-women.svg",
            description: "Slide 2 — Women (coming soon)",
        },
        {
            imgSrc: "/assets/img/placeholder-kids.svg",
            description: "Slide 3 — Kids (coming soon)",
        },
    ];

const Carousel: React.FC = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const handlePrev = () => {
        setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
    };

    const handleNext = () => {
        setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    };

    return (
        <div className="carousel-container">
            <div className="carousel-slides">
                {slides.map((slide, index) => (
                    <div
                        key={index}
                        className={`slide ${index === currentSlide ? 'active' : ''}`}
                    >
                        <img src={slide.imgSrc} alt={`Slide ${index}`} />
                        <p>{slide.description}</p>
                    </div>
                ))}
            </div>
            <button className="prev" onClick={handlePrev} aria-label="Previous Slide">❮</button>
            <button className="next" onClick={handleNext} aria-label="Next Slide">❯</button>

        </div>
    );
};

export default Carousel;
