package com.appTest.store.config;

import com.appTest.store.filters.JwtAuthorizationFilter;
import com.appTest.store.utils.JWTUtil;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JWTUtil jwtUtil;

    public SecurityConfig(JWTUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/index.html", "/files-html/**", "/files-css/**", "/files-js/**", "/img.logo/**").permitAll()
                        .requestMatchers("/auth/**").permitAll()

                        // ⟵ habilitar reservas
                        .requestMatchers("/stock-reservations/**").hasAnyRole("EMPLOYEE","OWNER")
                        .requestMatchers("/reservations/**").hasAnyRole("EMPLOYEE","OWNER")
                        .requestMatchers("/audits/**").hasAnyRole("EMPLOYEE","OWNER")
                        .requestMatchers("/stock-movements/**").hasAnyRole("EMPLOYEE","OWNER")


                        .anyRequest().authenticated()
                )
                .addFilterBefore(new JwtAuthorizationFilter(jwtUtil),
                        org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5500", "http://127.0.0.1:5500"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);
        // Exponer headers si más adelante devolvés info útil (p.ej. pagination)
        config.setExposedHeaders(List.of("Location", "X-Total-Count"));


        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}

