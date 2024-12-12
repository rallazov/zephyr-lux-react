import React, { useState } from 'react';
import './Carousel.css'; // Align this CSS with your brand

const Carousel: React.FC = () => {
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
