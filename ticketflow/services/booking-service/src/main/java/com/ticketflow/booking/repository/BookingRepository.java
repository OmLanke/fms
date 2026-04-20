package com.ticketflow.booking.repository;

import com.ticketflow.booking.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, String> {

    List<Booking> findByUserId(String userId);

    @Query("SELECT b FROM Booking b LEFT JOIN FETCH b.items WHERE b.id = :id")
    Optional<Booking> findByIdWithItems(@Param("id") String id);
}
