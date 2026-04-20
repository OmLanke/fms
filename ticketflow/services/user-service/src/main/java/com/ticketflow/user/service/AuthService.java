package com.ticketflow.user.service;

import com.ticketflow.user.dto.AuthResponse;
import com.ticketflow.user.dto.LoginRequest;
import com.ticketflow.user.dto.RegisterRequest;
import com.ticketflow.user.dto.UserDTO;
import com.ticketflow.user.entity.User;
import com.ticketflow.user.event.UserRegisteredEvent;
import com.ticketflow.user.repository.UserRepository;
import com.ticketflow.user.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException("Email already registered: " + request.email());
        }

        User user = User.builder()
                .name(request.name())
                .email(request.email())
                .password(passwordEncoder.encode(request.password()))
                .role("USER")
                .build();

        user = userRepository.save(user);
        log.info("Registered new user with id={}", user.getId());

        UserRegisteredEvent event = new UserRegisteredEvent(user.getId(), user.getEmail(), user.getName());
        kafkaTemplate.send("ticketflow.user.registered", user.getId(), event);
        log.info("Published user.registered event for userId={}", user.getId());

        String token = jwtUtil.generateToken(user);
        UserDTO userDTO = new UserDTO(user.getId(), user.getName(), user.getEmail(), user.getRole());
        return new AuthResponse(token, userDTO);
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + request.email()));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new BadCredentialsException("Invalid credentials");
        }

        String token = jwtUtil.generateToken(user);
        UserDTO userDTO = new UserDTO(user.getId(), user.getName(), user.getEmail(), user.getRole());
        return new AuthResponse(token, userDTO);
    }

    public UserDTO getMe(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with id: " + userId));
        return new UserDTO(user.getId(), user.getName(), user.getEmail(), user.getRole());
    }
}
