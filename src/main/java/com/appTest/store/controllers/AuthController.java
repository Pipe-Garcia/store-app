package com.appTest.store.controllers;

import com.appTest.store.models.User;
import com.appTest.store.services.IUserService;
import com.appTest.store.utils.JWTUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private IUserService userService;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JWTUtil jwtUtil;

    @Autowired
    private PasswordEncoder passwordEncoder; // <-- inyectado por campo (OK)

    // -------- LOGIN --------
    @PostMapping("/login")
    public ResponseEntity<JwtResponse> login(@RequestBody LoginRequest req) {
        try {
            var auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(req.username(), req.password())
            );
            var principal = (UserDetails) auth.getPrincipal();

            var user = userService.findByUsername(principal.getUsername()).orElseThrow();

            String token = jwtUtil.create(
                    String.valueOf(user.getId()),
                    user.getUsername(),
                    user.getRole().name()
            );
            return ResponseEntity.ok(new JwtResponse(token));
        } catch (AuthenticationException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new JwtResponse("Invalid credentials A1"));
        }
    }

    // -------- DIAGNÓSTICO (temporal) --------
    @GetMapping("/_diag")
    public Map<String, Object> diag() {
        var uOpt = userService.findByUsername("admin");
        boolean hasUser  = uOpt.isPresent();
        boolean enabled  = hasUser && uOpt.get().isEnabled();
        String  hash     = hasUser ? uOpt.get().getPassword() : null;
        boolean matches  = hasUser && passwordEncoder.matches("admin123", hash);
        return Map.of(
                "hasUser", hasUser,
                "matches_admin123", matches,
                "hashPrefix", hash != null ? hash.substring(0, 7) : null,
                "enabled", enabled
        );
    }

    // -------- FABRICAR BCRYPT (temporal) --------
    @GetMapping("/_mk")
    public Map<String, String> mk(@RequestParam String raw) {
        return Map.of("bcrypt", passwordEncoder.encode(raw));
    }

    // -------- QUIÉN SOY --------
    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(name = "Authorization", required = false) String auth) {
        if (auth == null || !auth.startsWith("Bearer ")) return ResponseEntity.status(401).build();
        try {
            var token = auth.substring(7);
            var claims = jwtUtil.getAllClaims(token);
            String username = claims.getSubject();
            String role = (String) claims.get("role");
            var opt = userService.findByUsername(username);
            if (opt.isEmpty()) return ResponseEntity.status(401).build();
            var u = opt.get();
            record Me(Long id, String username, String name, String lastName, String role) {}
            return ResponseEntity.ok(new Me(u.getId(), u.getUsername(), u.getName(), u.getLastName(), role));
        } catch (Exception e) {
            return ResponseEntity.status(401).build();
        }
    }

    // -------- REGISTRO (sólo OWNER) --------
    @PreAuthorize("hasRole('OWNER')")
    @PostMapping("/register")
    public ResponseEntity<?> registerOwnerOnly(@RequestBody User user) {
        if (userService.findByUsername(user.getUsername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Username already exists");
        }
        return ResponseEntity.ok(userService.save(user));
    }
}

record LoginRequest(String username, String password) {}
record JwtResponse(String token) {}
