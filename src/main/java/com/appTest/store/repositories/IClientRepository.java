package com.appTest.store.repositories;

import com.appTest.store.models.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IClientRepository extends JpaRepository<Client, Long> {

    boolean existsByDni(String dni);
    boolean existsByEmail(String email);

    Optional<Client> findByDni(String dni);
    Optional<Client> findByEmail(String email);
}

