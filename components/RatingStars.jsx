import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function RatingStars({ rating, size = 22, color = '#facc15' }) {
    const fullStars = Math.floor(rating);
    const partial = rating - fullStars;
    const partialWidth = Math.round(partial * size); // calcolo larghezza riempita

    return (
        <View style={{ flexDirection: 'row' }}>
            {[1, 2, 3, 4, 5].map((i) => {
                if (i <= fullStars) {
                    return <Ionicons key={i} name="star" size={size} color={color} />;
                }
                if (i === fullStars + 1 && partial > 0) {
                    return (
                        <View key={i} style={{ width: size, height: size, position: 'relative' }}>
                            <Ionicons name="star-outline" size={size} color={color} style={StyleSheet.absoluteFill} />
                            <View
                                style={{
                                    width: partialWidth,
                                    height: size,
                                    overflow: 'hidden',
                                    position: 'absolute',
                                }}
                            >
                                <Ionicons name="star" size={size} color={color} />
                            </View>
                        </View>
                    );
                }
                return <Ionicons key={i} name="star-outline" size={size} color={color} />;
            })}
        </View>
    );
}
