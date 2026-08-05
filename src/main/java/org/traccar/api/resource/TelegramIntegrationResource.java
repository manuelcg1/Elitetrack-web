/*
 * Copyright 2026 Anton Tananaev (anton@traccar.org)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
package org.traccar.api.resource;

import jakarta.inject.Inject;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.traccar.api.BaseResource;
import org.traccar.config.Config;
import org.traccar.config.Keys;
import org.traccar.helper.LogAction;
import org.traccar.model.User;
import org.traccar.notification.MessageException;
import org.traccar.notification.NotificationMessage;
import org.traccar.notification.NotificatorManager;
import org.traccar.notificators.NotificatorTelegram;
import org.traccar.storage.StorageException;
import org.traccar.storage.query.Columns;
import org.traccar.storage.query.Condition;
import org.traccar.storage.query.Order;
import org.traccar.storage.query.Request;

import java.util.List;
import java.util.regex.Pattern;

@Path("telegram")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class TelegramIntegrationResource extends BaseResource {

    private static final String ATTRIBUTE_CHAT_ID = "telegramChatId";
    private static final Pattern INDIVIDUAL_CHAT_ID = Pattern.compile("\\d{5,20}");
    private static final String TEST_MESSAGE = "Prueba de Telegram EliteTrack\n\n"
            + "La cuenta fue vinculada correctamente.\n\n"
            + "Si recibe este mensaje, las notificaciones están funcionando correctamente.";

    public record Status(String status) {
    }

    public record TelegramUser(long id, String name, String email, boolean linked, String maskedChatId) {
    }

    public record LinkRequest(String telegramChatId) {
    }

    @Inject
    Config config;

    @Inject
    NotificatorManager notificatorManager;

    @Inject
    LogAction actionLogger;

    @Context
    HttpServletRequest request;

    @GET
    @Path("status")
    public Status getStatus() throws StorageException {
        permissionsService.checkAdmin(getUserId());
        String token = config.getString(Keys.NOTIFICATOR_TELEGRAM_KEY);
        if (token == null || token.isBlank()
                || notificatorManager.getAllNotificatorTypes().stream()
                        .noneMatch(type -> "telegram".equals(type.type()))) {
            return new Status("notConfigured");
        }
        try {
            ((NotificatorTelegram) notificatorManager.getNotificator("telegram")).checkConnection();
            return new Status("connected");
        } catch (RuntimeException | MessageException e) {
            return new Status("connectionError");
        }
    }

    @GET
    @Path("users")
    public List<TelegramUser> getUsers() throws StorageException {
        permissionsService.checkAdmin(getUserId());
        return storage.getObjects(User.class, new Request(new Columns.All(), new Order("name")))
                .stream().map(TelegramIntegrationResource::toTelegramUser).toList();
    }

    @PUT
    @Path("users/{userId}")
    public TelegramUser link(@PathParam("userId") long userId, LinkRequest linkRequest) throws StorageException {
        permissionsService.checkAdmin(getUserId());
        String chatId = validateChatId(linkRequest != null ? linkRequest.telegramChatId() : null);
        User user = getUser(userId);
        user.set(ATTRIBUTE_CHAT_ID, chatId);
        storage.updateObject(user, new Request(
                new Columns.Include("attributes"), new Condition.Equals("id", userId)));
        actionLogger.edit(request, getUserId(), user);
        return toTelegramUser(user);
    }

    @DELETE
    @Path("users/{userId}")
    public Response unlink(@PathParam("userId") long userId) throws StorageException {
        permissionsService.checkAdmin(getUserId());
        User user = getUser(userId);
        user.removeAttribute(ATTRIBUTE_CHAT_ID);
        storage.updateObject(user, new Request(
                new Columns.Include("attributes"), new Condition.Equals("id", userId)));
        actionLogger.edit(request, getUserId(), user);
        return Response.noContent().build();
    }

    @POST
    @Path("users/{userId}/test")
    public Response test(@PathParam("userId") long userId) throws StorageException {
        permissionsService.checkAdmin(getUserId());
        User user = getUser(userId);
        String chatId = user.getString(ATTRIBUTE_CHAT_ID);
        if (chatId == null || chatId.isBlank()) {
            throw new BadRequestException("El usuario no tiene Telegram vinculado.");
        }
        try {
            notificatorManager.getNotificator("telegram").send(
                    user, new NotificationMessage("EliteTrack", TEST_MESSAGE, TEST_MESSAGE, false), null, null);
        } catch (RuntimeException e) {
            throw new ServiceUnavailableException("Telegram no está configurado.");
        } catch (MessageException e) {
            throw new ServiceUnavailableException("No se pudo enviar el mensaje de prueba.");
        }
        return Response.noContent().build();
    }

    private User getUser(long userId) throws StorageException {
        User user = storage.getObject(User.class, new Request(
                new Columns.All(), new Condition.Equals("id", userId)));
        if (user == null) {
            throw new NotFoundException("Usuario no encontrado.");
        }
        return user;
    }

    static String validateChatId(String chatId) {
        String value = chatId != null ? chatId.trim() : "";
        if (value.startsWith("-")) {
            throw new BadRequestException("Los grupos de Telegram aún no son compatibles.");
        }
        if (!INDIVIDUAL_CHAT_ID.matcher(value).matches()) {
            throw new BadRequestException("El Telegram Chat ID debe contener entre 5 y 20 dígitos.");
        }
        return value;
    }

    static String maskChatId(String chatId) {
        if (chatId == null || chatId.isBlank()) {
            return null;
        }
        return "••••••" + chatId.substring(Math.max(0, chatId.length() - 4));
    }

    private static TelegramUser toTelegramUser(User user) {
        String chatId = user.getString(ATTRIBUTE_CHAT_ID);
        return new TelegramUser(user.getId(), user.getName(), user.getEmail(),
                chatId != null && !chatId.isBlank(), maskChatId(chatId));
    }

}
